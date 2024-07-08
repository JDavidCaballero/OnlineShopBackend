const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

//products
const productSchema = new mongoose.Schema({
  productID: String,
  nombre: String,
  descripcion: String,
  categoria: String,
  precio: Number,
});

//user
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const Product = mongoose.model("Product", productSchema);
const Categories = mongoose.model("Categories", productSchema);
const User = mongoose.model("users", userSchema);

// Rutas
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).send(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Categories.find();
    res.status(200).send(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//post
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

app.post("/api/users/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });
    await user.save();
    res
      .status(201)
      .send({ userCreated: user, message: "User created successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});

const JWT_SECRET = "yourSecretKey";

app.post("/api/users/login", async (req, res) => {
  // Find the user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(400).send({ message: "User not found" });
  }

  // Check if the password is correct
  const isMatch = await bcrypt.compare(req.body.password, user.password);
  if (!isMatch) {
    return res.status(400).send({ message: "Invalid credentials" });
  }

  // Generate a token
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: "1h" } // Token expires in 1 hour
  );

  // Return the user object and token
  res.send({
    user: {
      name: user.name,
      email: user.email,
    },
    accessToken: token,
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}...`);
});
