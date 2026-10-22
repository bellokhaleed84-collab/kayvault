import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const email = process.argv[2];
if (!email) { console.error('Usage: npm run make-admin -- you@example.com'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
const u = await User.findOneAndUpdate({ email: email.toLowerCase() }, { is_admin: true }, { new: true });
console.log(u ? `${u.email} is now an admin` : 'No user with that email');
await mongoose.disconnect();
