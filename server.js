const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Conexión a MongoDB
mongoose
  .connect("mongodb://localhost:27017/myapidb", {})
  .then(() => console.log("Conectado a MongoDB..."))
  .catch((err) => console.error("No se pudo conectar a MongoDB...", err));

// Definir esquema y modelo
const productSchema = new mongoose.Schema({
  productID: String,
  nombre: String,
  descripcion: String,
  categoria: String,
  precio: Number,
});

const Product = mongoose.model("Product", productSchema);

// Rutas
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).send(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/products", async (req, res) => {
  const product = new Product({
    productID: req.body.productID,
    nombre: req.body.nombre,
    descripcion: req.body.descripcion,
    categoria: req.body.categoria,
    precio: req.body.precio,
  });
  await product.save();
  res.send(product);
});

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Product.find().distinct("categoria");
    res.status(200).send(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}...`);
});
