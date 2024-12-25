const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

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

async function run() {
  try {
    const database = client.db('HotelDB');
    const roomsCollection = database.collection('rooms');
    const bookingsCollection = database.collection('bookings');
    const reviewsCollection = database.collection('reviews');

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


    // 1. Get bookings for a specific user
    app.get('/bookings', async (req, res) => {
      const email = req.query.email;
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
  res.send('Hello from SoloSphere Server....');
});
// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
