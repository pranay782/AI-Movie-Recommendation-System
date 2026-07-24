const mongoose = require('mongoose');
const dns = require('dns');

// Use Google DNS to resolve Atlas SRV records
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌ MONGODB_URI not set'); return; }

  console.log('🔌 Connecting to MongoDB...');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS:          45000,
      family: 4,
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB failed: ${err.message}`);

    if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEOUT')) {
      console.error('');
      console.error('══════════════════════════════════════════════════════════════');
      console.error('  YOUR NETWORK BLOCKS SRV DNS — do ONE of these:');
      console.error('');
      console.error('  OPTION A (easiest): Get direct connection string from Atlas');
      console.error('    → cloud.mongodb.com → Connect → Drivers → Node.js');
      console.error('    → toggle OFF "Use SRV" → copy the mongodb:// URL');
      console.error('    → paste as MONGODB_URI in .env.example');
      console.error('');
      console.error('  OPTION B: Change your DNS to 8.8.8.8 in Windows');
      console.error('    → Control Panel → Network → Adapter Settings');
      console.error('    → Properties → IPv4 → use 8.8.8.8 / 8.8.4.4');
      console.error('══════════════════════════════════════════════════════════════');
      console.error('');
    } else if (err.message.includes('Authentication') || err.message.includes('bad auth')) {
      console.error('FIX: Wrong password → Atlas → Database Access → Edit user → update .env.example');
    } else if (err.message.includes('whitelist') || err.message.includes('not allowed')) {
      console.error('FIX: Add your IP → Atlas → Network Access → Add IP → 0.0.0.0/0');
    }

    console.error('⚠️  Server will start WITHOUT database.');
    console.error('    Movies (TMDB) will work. Login/Register/Watchlist will NOT.');
    console.error('');
    // Do NOT process.exit — let Express start so TMDB routes work
  }
};

// Middleware to check DB is live before hitting user routes
const requireDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database not connected. Please fix your MongoDB Atlas connection and restart the server.'
    });
  }
  next();
};

module.exports = connectDB;
module.exports.requireDB = requireDB;
