
const express = require("express");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();
const productRoutes = require("./routes/productRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");

app.use(express.json());
app.use("/api/products", productRoutes);

app.get("/", (req, res) => {
    res.send("Inventory Management System API is Running!");
});

const startServer = async () => {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

app.use(errorMiddleware);

startServer();