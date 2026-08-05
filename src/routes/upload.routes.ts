import express, { type Request, type Response } from 'express';
import upload from '../middlewares/upload.js';
import cloudinary from '../config/cloudinary.js';
import AdmZip from 'adm-zip';

const router = express.Router();

// Single image upload
router.post('/', upload.single('image'), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(fileBase64, { 
      folder: 'batik_store_products', 
      timeout: 120000 
    });

    res.status(200).json({ 
      message: 'Image uploaded successfully', 
      imageUrl: result.secure_url 
    });
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
      const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      return cloudinary.uploader.upload(fileBase64, { 
        folder: 'batik_store_products', 
        timeout: 120000 
      }).then(result => result.secure_url);
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

// Bulk Images upload via Zip
router.post('/bulk-images', upload.single('file'), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No zip file uploaded' });
    }

    const zip = new AdmZip(req.file.buffer);
    const files: { filename: string; url: string }[] = [];
    const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

    const uploadPromises: Promise<{ filename: string; url: string }>[] = [];
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      
      const name = entry.entryName.split('/').pop();
      if (!name || !IMAGE_EXT.test(name)) continue;
      
      const buffer = entry.getData();
      
      const fileBase64 = `data:image/${name.split('.').pop()};base64,${buffer.toString('base64')}`;
      const p = cloudinary.uploader.upload(fileBase64, { 
        folder: 'batik_store_products', 
        timeout: 120000 
      }).then(result => ({ filename: name, url: result.secure_url }));
      uploadPromises.push(p);
    }
    
    const uploaded = await Promise.all(uploadPromises);
    files.push(...uploaded);

    res.status(200).json({ 
      message: `${files.length} images uploaded successfully from zip`,
      files 
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
