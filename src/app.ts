import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { contacts, Contact } from './db/schema';
import { db } from './db';

// Load environment variables
dotenv.config();

// Import routes (we'll create these later)


class App {
    public app: Application;

    constructor() {
        this.app = express();
        this.config();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private config(): void {
        this.app.set('port', process.env.PORT || 3000);
    }

    private initializeMiddlewares(): void {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private initializeRoutes(): void {
        // Health check route
        this.app.get('/health', (req: Request, res: Response) => {
            res.status(200).json({ status: 'OK', timestamp: new Date() });
        });

        this.app.post('/identify', async (req: Request, res: Response) => {
            try {
                const { email, phoneNumber } = req.body as {
                    email?: string;
                    phoneNumber?: string;
                };

                if (!email && !phoneNumber) {
                    return res.status(400).json({ error: 'Either email or phoneNumber is required' });
                }

                // Build where conditions
                const conditions = [];
                if (email) conditions.push(eq(contacts.email, email));
                if (phoneNumber) conditions.push(eq(contacts.phoneNumber, phoneNumber));

                // Find existing contacts that match email or phone
                const existingContacts = conditions.length > 0
                    ? await db
                        .select()
                        .from(contacts)
                        .where(or(...conditions))
                    : [];

                if (existingContacts.length === 0) {
                    // No existing contacts, create a new primary contact
                    const newContact = {
                        phoneNumber: phoneNumber || null,
                        email: email || null,
                        linkedId: null,
                        linkPrecedence: 'primary' as const,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    const result = await db.insert(contacts).values(newContact);
                    const insertId = Number(result[0].insertId);

                    return res.status(200).json({
                        contact: {
                            primaryContatctId: insertId,
                            emails: email ? [email] : [],
                            phoneNumbers: phoneNumber ? [phoneNumber] : [],
                            secondaryContactIds: []
                        }
                    });
                }

                // Find all primary contacts in the result
                const primaryContacts = existingContacts.filter((c: Contact) => c.linkPrecedence === 'primary');
                const secondaryContacts = existingContacts.filter((c: Contact) => c.linkPrecedence === 'secondary');
                
                // Get all linked contacts (including those not in the initial query)
                let allLinkedContacts: Contact[] = [];
                let primaryContact: Contact | undefined;
                
                // Case 1: We found one or more primary contacts
                if (primaryContacts.length > 0) {
                    // If multiple primaries, the oldest one should be the real primary
                    primaryContacts.sort((a: Contact, b: Contact) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    primaryContact = primaryContacts[0];
                    
                    // If we have multiple primaries, we need to convert the newer ones to secondary
                    if (primaryContacts.length > 1) {
                        const newerPrimaries = primaryContacts.slice(1);
                        
                        // Update newer primaries to be secondary linked to the oldest primary
                        for (const contact of newerPrimaries) {
                            await db.update(contacts)
                                .set({
                                    linkedId: primaryContact!.id,
                                    linkPrecedence: 'secondary',
                                    updatedAt: new Date()
                                })
                                .where(eq(contacts.id, contact.id));
                                
                            // Also update any contacts linked to these primaries
                            await db.update(contacts)
                                .set({
                                    linkedId: primaryContact!.id,
                                    updatedAt: new Date()
                                })
                                .where(eq(contacts.linkedId, contact.id));
                        }
                    }
                }
                // Case 2: We only found secondary contacts
                else if (secondaryContacts.length > 0) {
                    // Get the primary contact for these secondaries
                    const linkedIds = [...new Set(secondaryContacts.map((c: Contact) => c.linkedId).filter(Boolean))] as number[];
                    
                    if (linkedIds.length > 0) {
                        const linkedPrimaries = await db
                            .select()
                            .from(contacts)
                            .where(inArray(contacts.id, linkedIds));
                            
                        if (linkedPrimaries.length > 0) {
                            // Sort by creation date to get the oldest
                            linkedPrimaries.sort((a: Contact, b: Contact) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                            primaryContact = linkedPrimaries[0];
                        }
                    }
                }
                
                if (!primaryContact) {
                    throw new Error('Primary contact not found');
                }
                
                // Check if we need to create a new secondary contact
                const hasNewInfo = !existingContacts.some((contact: Contact) => 
                    (email && contact.email === email) || 
                    (phoneNumber && contact.phoneNumber === phoneNumber)
                );
                
                if (hasNewInfo && (email || phoneNumber) && primaryContact) {
                    const newSecondaryContact = {
                        phoneNumber: phoneNumber || null,
                        email: email || null,
                        linkedId: primaryContact.id,
                        linkPrecedence: 'secondary' as const,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    await db.insert(contacts).values(newSecondaryContact);
                }
                
                // Get all contacts linked to this primary (including the primary itself)
                if (primaryContact) {
                    allLinkedContacts = await db
                        .select()
                        .from(contacts)
                        .where(
                            or(
                                eq(contacts.id, primaryContact.id),
                                eq(contacts.linkedId, primaryContact.id)
                            )
                        );
                }
                
                // Prepare response - ensure primary contact's email/phone are first in the arrays
                const allEmails = allLinkedContacts
                    .map(c => c.email)
                    .filter(Boolean);
                    
                const allPhoneNumbers = allLinkedContacts
                    .map(c => c.phoneNumber)
                    .filter(Boolean);
                
                // Remove duplicates while preserving order
                const emails = [...new Set(allEmails)];
                const phoneNumbers = [...new Set(allPhoneNumbers)];
                
                // Get all secondary contact IDs
                const secondaryContactIds = primaryContact ? allLinkedContacts
                    .filter((c: Contact) => c.id !== primaryContact.id)
                    .map((c: Contact) => c.id) : [];
                
                // Ensure primary's email and phone are first in the arrays
                if (primaryContact && primaryContact.email && emails.includes(primaryContact.email)) {
                    const index = emails.indexOf(primaryContact.email);
                    if (index > 0) {
                        emails.splice(index, 1);
                        emails.unshift(primaryContact.email);
                    }
                }
                
                if (primaryContact && primaryContact.phoneNumber && phoneNumbers.includes(primaryContact.phoneNumber)) {
                    const index = phoneNumbers.indexOf(primaryContact.phoneNumber);
                    if (index > 0) {
                        phoneNumbers.splice(index, 1);
                        phoneNumbers.unshift(primaryContact.phoneNumber);
                    }
                }

                if (!primaryContact) {
                    throw new Error('Primary contact not found after processing');
                }
                
                return res.status(200).json({
                    contact: {
                        primaryContatctId: primaryContact.id,
                        emails,
                        phoneNumbers,
                        secondaryContactIds
                    }
                });

            } catch (error) {
                console.error('Error in /identify:', error);
                return res.status(500).json({ error: 'Internal server error' });
            }
        })

        this.app.get('/identify', async (req: Request, res: Response) => {
            try {

                const getContacts = await db.select().from(contacts)

                return res.status(200).json({ contacts: getContacts });
            } catch (error) {
                console.error('Error in /identity:', error);
                return res.status(500).json({ error: 'Internal server error' });
            }
        })

        

        
        // Add your routes here

        // 404 handler
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({ message: 'Not Found' });
        });
    }

    private initializeErrorHandling(): void {
        // Error handling middleware
        this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            console.error(err.stack);
            res.status(500).json({
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        });
    }

    public start(): void {
        const port = this.app.get('port');
        this.app.listen(port, () => {
            console.log(`Server is running on port ${port} in ${this.app.get('env')} mode`);
        });
    }
}

export default new App();