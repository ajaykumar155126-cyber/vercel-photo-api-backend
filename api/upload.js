import nodemailer from "nodemailer";
import cloudinary from "cloudinary";

// Bigger body size support
export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } }
};

// Cloudinary Setup
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  
  // FULL CORS FIX
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ msg: "Only POST allowed" });
  }

  try {
    const {
      image,
      dateTime,
      deviceModel,
      browser,
      resolution,
      ip,
      ipLocation
    } = req.body;

    if (!image) return res.status(400).json({ error: "No image received" });

    // Upload to Cloudinary
    const uploadRes = await cloudinary.v2.uploader.upload(image, {
      folder: "user_photos",
    });

    const photoURL = uploadRes.secure_url;

    // Email Setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mapsURL = `https://www.google.com/maps?q=${ipLocation}`;

    // Send Email
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded ✔",
      html: `
        <h2>New Photo Uploaded</h2>

        <p><b>Date & Time:</b> ${dateTime}</p>
        <p><b>Device:</b> ${deviceModel}</p>
        <p><b>Browser:</b> ${browser}</p>
        <p><b>Photo Resolution:</b> ${resolution}</p>
        <p><b>IP Address:</b> ${ip}</p>

        <p><b>IP Based Location:</b> 
        <a href="${mapsURL}" target="_blank">Google Maps Link</a></p>

        <br>
        <a href="${photoURL}" target="_blank"
           style="font-size:16px; padding:10px 16px; background:#007bff;
           color:white; border-radius:6px; text-decoration:none;">
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
