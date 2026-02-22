const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const axios = require('axios');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Post model
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  excerpt: String,
  imageUrl: String,
  date: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', postSchema);

// Contact model
const contactSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  subject: String,
  message: String,
  date: { type: Date, default: Date.now },
});

const Contact = mongoose.model('Contact', contactSchema);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'blog_images',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: storage });

// Routes
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ date: -1 });
    // Transform _id to id for the frontend
    const formattedPosts = posts.map((post) => ({
      ...post.toObject(),
      id: post._id.toString(),
    }));
    res.json(formattedPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posts', upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const excerpt = content ? content.substring(0, 100) + '...' : '';
    const imageUrl = req.file ? req.file.path : ''; // path in cloudinary is the full URL

    const newPost = new Post({ title, content, excerpt, imageUrl });
    await newPost.save();

    res.status(201).json({ ...newPost.toObject(), id: newPost._id.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/posts/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const updates = { title, content };
    if (content) updates.excerpt = content.substring(0, 100) + '...';
    if (req.file) updates.imageUrl = req.file.path; // New image uploaded

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updatedPost = await Post.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedPost) return res.status(404).json({ error: 'Post not found' });

    res.json({ ...updatedPost.toObject(), id: updatedPost._id.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const deletedPost = await Post.findByIdAndDelete(id);
    if (!deletedPost) return res.status(404).json({ error: 'Post not found' });

    // Optionally delete image from Cloudinary here by plucking the public_id from imageUrl

    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Contact Routes
app.get('/api/contact', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ date: -1 });
    const formattedContacts = contacts.map((contact) => ({
      ...contact.toObject(),
      id: contact._id.toString(),
    }));
    res.json(formattedContacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, phone, email, subject, message } = req.body;

    const newContact = new Contact({ name, phone, email, subject, message });
    await newContact.save();

    // Send email notification using Web3Forms HTTP API
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;

    if (accessKey) {
      try {
        const response = await axios.post(
          'https://api.web3forms.com/submit',
          {
            access_key: accessKey,
            subject: `Nuevo mensaje de contacto: ${subject}`,
            from_name: name,
            email: email, // This is the user's email, Web3forms supports it for "Reply To"
            message: `Has recibido un nuevo mensaje de contacto.\n\nNombre: ${name}\nTeléfono: ${phone}\nEmail: ${email}\nAsunto: ${subject}\n\nMensaje:\n${message}`,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        );

        const data = response.data;
        if (data.success) {
          console.log('Correo enviado con éxito mediante Web3Forms');
        } else {
          console.error('Error de Web3Forms:', data);
          return res
            .status(500)
            .json({ error: 'Error al procesar el envío del correo en la plataforma externa.' });
        }
      } catch (emailError) {
        console.error('Error enviando correo con Web3Forms:', emailError.message);
        return res.status(500).json({ error: 'Error de red al intentar enviar el correo.' });
      }
    } else {
      console.warn(
        'WEB3FORMS_ACCESS_KEY no está configurado. El correo no se enviará, pero el mensaje se guardará.',
      );
    }

    res.status(201).json({ ...newContact.toObject(), id: newContact._id.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contact/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const deletedContact = await Contact.findByIdAndDelete(id);
    if (!deletedContact) return res.status(404).json({ error: 'Contact not found' });

    res.json({ message: 'Contact deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
