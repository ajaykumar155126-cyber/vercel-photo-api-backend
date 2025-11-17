import cloudinary from "cloudinary";
import nodemailer from "nodemailer";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  // CORS FIX FOR NETLIFY + ANY FRONTEND
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

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

    // SEND HTML EMAIL WITH BUTTON
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded ✔",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #222;">New Photo Uploaded</h2>
          <p style="font-size: 15px; color: #444;">Your new photo is ready.</p>

          <a href="${photoURL}"
             style="
               display: inline-block;
               background: #007bff;
               color: #fff;
               padding: 12px 20px;
               text-decoration: none;
               border-radius: 8px;
               font-size: 16px;
               margin-top: 10px;
             ">
            View Uploaded Photo
          </a>

          <br><br>

          <img src="${photoURL}" 
               alt="Photo Preview" 
               style="width: 220px; border-radius: 10px; margin-top: 15px;">
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      url: photoURL,
      message: "Photo uploaded and email sent",
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
