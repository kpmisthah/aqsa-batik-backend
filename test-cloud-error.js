import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({
  cloud_name: undefined,
  api_key: undefined,
  api_secret: undefined,
});

cloudinary.api.ping()
  .then(res => console.log("Success:", res))
  .catch(err => console.error("Error:", err));
