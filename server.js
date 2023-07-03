const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);

// cors configuration
const corsOptions = {
  origin: "https://e-commerce-lac-three.vercel.app",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// database configuration
const connection = mysql.createConnection(process.env.DATABASE_URL);

// default
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// products
app.get("/products", (req, res) => {
  connection.query("SELECT * FROM shop_products", (error, results) => {
    if (error) {
      console.error("Error retrieving products:", error);
      res.status(500).json({ error: "Failed to retrieve products" });
    } else {
      res.json(results);
    }
  });
});

// checkout
const getShopProduct = (itemId) => {
  return new Promise((resolve, reject) => {
    connection.execute(
      "SELECT * FROM shop_products WHERE id = ?",
      [itemId],
      function (err, rows) {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

app.post("/checkout", async (req, res) => {
  const payload = req.body;
  try {
    const lineItems = await Promise.all(
      payload.map(async (item) => {
        try {
          const rows = await getShopProduct(item.id);
          const product = rows[0];
          return {
            ...product,
            quantity: item.quantity,
          };
        } catch (error) {
          console.error(error);
          throw new Error("Error retrieving data from database");
        }
      })
    );

    const lineItemsReady = lineItems.map((item) => {
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      };
    });

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: lineItemsReady,
        success_url: `${process.env.FRONTEND_URL}`,
        cancel_url: `${process.env.FRONTEND_URL}`,
      });

      res.send({ url: session.url });
    } catch (error) {
      console.log("error creating url" + error);
    }
  } catch (error) {
    console.error("Error during checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

// listen
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
