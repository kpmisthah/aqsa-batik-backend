import express, { type Request, type Response } from 'express';
import upload from '../middlewares/upload.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// Single image upload
router.post('/', upload.single('image'), (req: Request, res: Response): any => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'batik_store_products', timeout: 120000 },
      (error: any, result: any) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: 'Upload to Cloudinary failed', error });
        }
        res.status(200).json({ 
          message: 'Image uploaded successfully', 
          imageUrl: result.secure_url 
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// Multiple images upload
router.post('/multiple', upload.array('images', 10), async (req: Request, res: Response): Promise<any> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const uploadPromises = files.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'batik_store_products', timeout: 120000 },
          (error: any, result: any) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        uploadStream.end(file.buffer);
      });
    });

    const imageUrls = await Promise.all(uploadPromises);
    res.status(200).json({ 
      message: `${imageUrls.length} images uploaded successfully`, 
      imageUrls 
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
