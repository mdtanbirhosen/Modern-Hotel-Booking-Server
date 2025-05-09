const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken')
require('dotenv').config();

const port = process.env.PORT || 5000;
const app = express();

// changed
const corsOptions = {
  origin: ['http://localhost:5173','https://visa-navigator-server-side.vercel.app','https://modern-hotel-booking-client.vercel.app'],
  credentials: true,

}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q5jln.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify token
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: 'unauthorized access' })
  jwt.verify(token, process.env.JWT_SECRET_TOKEN, (error, decoded) => {
    if(error){
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
  })

  next()
}

async function run() {
  try {
    const database = client.db('HotelDB');
    const roomsCollection = database.collection('rooms');
    const bookingsCollection = database.collection('bookings');
    const reviewsCollection = database.collection('reviews');

    // jwt generate ==> tanjim created
    app.post('/jwt', async (req, res) => {
      const email = req.body;
      // create jwt
      const token = jwt.sign(email, process.env.JWT_SECRET_TOKEN, { expiresIn: '250d' })
      // console.log(token);
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true })
    })

    // jwt clear
    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true })
    })

    // Get all rooms
    app.get('/rooms', async (req, res) => {
      try {
        const { minPrice, maxPrice } = req.query; // Extract minPrice and maxPrice from query params

        // Build a filter object
        const filter = {};
        if (minPrice) {
          filter.price = { $gte: parseFloat(minPrice) }; // Filter rooms with price >= minPrice
        }
        if (maxPrice) {
          filter.price = filter.price || {};
          filter.price.$lte = parseFloat(maxPrice); // Filter rooms with price <= maxPrice
        }

        const result = await roomsCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).send({ error: 'Failed to fetch rooms.' });
      }
    });



    // get room data for details page
    app.get('/roomDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query)
      res.send(result)
    })

    // get specific rooms review
    app.get('/reviews/:roomId', async (req, res) => {
      const roomId = req.params.roomId;
      query = { roomId: roomId };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result)
    })
    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })

    // changed
    // 1. Get bookings for a specific user
    app.get('/bookings', verifyToken, async (req, res) => {
      const decodedEmail = req?.user?.email
      const email = req.query.email;
      console.log('email from token-->', decodedEmail)
      console.log('email from params-->', email)
      if(decodedEmail !== email) return res.status(401).send({ message: 'unauthorized access' })
      const result = await bookingsCollection.find({ userEmail: email }).toArray();
      res.send(result);

    });

    // 2. Add a new booking
    app.post('/bookings', async (req, res) => {
      try {
        const booking = req.body; // Expecting booking details from the client
        if (!booking.userEmail || !booking.roomId || !booking.bookingDate) {
          return res.status(400).send({ error: 'Required fields are missing.' });
        }
        const result = await bookingsCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to add booking.' });
      }
    });

    // 3. Update booking date
    app.put('/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { bookingDate } = req.body;
        if (!bookingDate) {
          return res.status(400).send({ error: 'Booking date is required.' });
        }
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { bookingDate } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to update booking.' });
      }
    });

    // 4. Delete a booking
    app.delete('/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to delete booking.' });
      }
    });


    // 5. Add a review for a booking
    app.post('/reviews', async (req, res) => {
      try {
        const review = req.body; // Expecting { bookingId, rating, comment }
        if (!review.bookingId || !review.rating || !review.comment) {
          return res.status(400).send({ error: 'Required fields are missing.' });
        }
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to add review.' });
      }
    });
    // update availability from details page
    // PATCH /rooms/:id/availability
    app.patch("/rooms/:id/availability", async (req, res) => {
      const roomId = req.params.id;
      const { availability } = req.body;

      try {
        const result = await roomsCollection.updateOne(
          { _id: new ObjectId(roomId) },
          { $set: { availability } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Room availability updated successfully" });
        } else {
          res.status(404).send({ message: "Room not found" });
        }
      } catch (error) {
        console.error("Error updating room availability:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });



  } finally {
    // Optional: Close the connection when the app stops (disabled for now)
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from modern hotel Server....');
});
// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
