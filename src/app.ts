import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

        this.app.post('/identify', (req: Request, res: Response) => {
            res.status(200).json({ status: 'OK', timestamp: new Date() });
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