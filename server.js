const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

const postsFile = path.join(__dirname, 'posts.json');
// Initialize data file if it doesn't exist
if (!fs.existsSync(postsFile)) {
  fs.writeFileSync(
    postsFile,
    JSON.stringify(
      [
        {
          id: '1',
          title: 'Bienvenido a nuestro nuevo Blog',
          excerpt: 'Estrenamos sección de noticias...',
          content:
            'Estamos muy contentos de anunciar el lanzamiento de nuestra nueva web. Aquí publicaremos consejos de salud, noticias sobre el sector y mucho más.',
          imageUrl:
            'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=500&q=60',
          date: new Date(),
        },
        {
          id: '2',
          title: 'Consejos para el cuidado en verano',
          excerpt: 'La hidratación es clave...',
          content:
            'Con la llegada del calor, es fundamental mantener una buena hidratación, especialmente en personas mayores. Beber agua frecuentemente, evitar las horas centrales del día...',
          imageUrl:
            'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=500&q=60',
          date: new Date(),
        },
      ],
      null,
      2,
    ),
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

function getPosts() {
  const data = fs.readFileSync(postsFile);
  return JSON.parse(data);
}

function savePosts(posts) {
  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
}

app.get('/api/posts', (req, res) => {
  const posts = getPosts();
  res.json(posts);
});

app.post('/api/posts', upload.single('image'), (req, res) => {
  const { title, content } = req.body;
  const excerpt = content ? content.substring(0, 100) + '...' : '';
  const posts = getPosts();

  const newPost = {
    id: Date.now().toString(),
    title,
    content,
    excerpt,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    date: new Date(),
  };

  posts.unshift(newPost);
  savePosts(posts);
  res.status(201).json(newPost);
});

app.put('/api/posts/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const posts = getPosts();
  const index = posts.findIndex((p) => p.id === id);

  if (index !== -1) {
    const updatedPost = {
      ...posts[index],
      title: title || posts[index].title,
      content: content || posts[index].content,
      excerpt: content ? content.substring(0, 100) + '...' : posts[index].excerpt,
    };

    // Only update image if a new one was uploaded
    if (req.file) {
      updatedPost.imageUrl = `/uploads/${req.file.filename}`;
    }

    posts[index] = updatedPost;
    savePosts(posts);
    res.json(updatedPost);
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
});

app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  let posts = getPosts();
  const initialLength = posts.length;
  posts = posts.filter((p) => p.id !== id);

  if (posts.length < initialLength) {
    savePosts(posts);
    res.json({ message: 'Post deleted' });
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
