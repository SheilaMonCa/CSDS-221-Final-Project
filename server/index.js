const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    process.env.CLIENT_URL, // your Vercel URL e.g. https://your-app.vercel.app
  ],
  credentials: true,
}));

app.use(express.json());

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/games',       require('./routes/games'));
app.use('/api/game-nights', require('./routes/game-nights'));
app.use('/api/users',       require('./routes/users'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));