import { Router } from 'express';
import { serveImage } from '../controllers/imageController.js';

const router = Router();

router.get('/:key', serveImage);

export default router;
