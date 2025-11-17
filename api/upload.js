import nodemailer from "nodemailer";
import cloudinary from "cloudinary";

// Allow big base64 images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

// Cloudinary setup
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  // CORS FIX (Netlify + All domains)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ msg: "Only POST allowed" });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image received" });
    }

    // Upload to Cloudinary
    const uploadResponse = await cloudinary.v2.uploader.upload(image, {
      folder: "user_photos",
    });

    const photoURL = uploadResponse.secure_url;

    // Nodemailer (Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Email (same as your old version)
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded ✔",
      html: `
        <h2>New Photo Uploaded</h2>
        <p>Click the link below to view your image:</p>
        <a href="${photoURL}" target="_blank" 
           style="font-size: 16px; padding: 8px 14px; background: #007bff; 
           color: white; border-radius: 6px; text-decoration: none;">
          View Uploaded Photo
        </a>
      `,
    });

    return res.status(200).json({
      success: true,
      url: photoURL,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
