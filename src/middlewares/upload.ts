import multer from 'multer';

// Use memory storage so we can buffer the file directly to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

export default upload;
