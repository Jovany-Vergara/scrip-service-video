const express = require('express');
const port = 3001;
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const range = require('express-range');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'images')));

let videoPath;
let ffmpegProcess;

app.get('/start', (req, res) => {
  const date = new Date();
  const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  const videoName = `${dateString}_${Math.floor(Math.random() * 1001)}`;
  videoPath = path.join(__dirname, `./images/${videoName}.mp4`);

  ffmpegProcess = spawn('ffmpeg', [
    '-f', 'dshow',
    '-i', 'video=Integrated Webcam',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-t', '10',
    videoPath
  ]);

  ffmpegProcess.on('error', function (err) {
    console.log('An error occurred: ' + err.message);
    res.send(JSON.stringify({ success: false, result: 'Ocurrió un error: ' + err.message }));
  });

  ffmpegProcess.on('close', function (code) {
    console.log('Processing finished with code ' + code);
    ffmpegProcess = null;
  });

  res.send(JSON.stringify({ success: true, result: 'Grabación iniciada' }));
});

app.get('/end', (req, res) => {
  if (!ffmpegProcess) {
    res.send(JSON.stringify({ success: false, result: 'No hay ninguna grabación en curso' }));
    return;
  }

  ffmpegProcess.stdin.write('q');

  ffmpegProcess.on('exit', (code, signal) => {
    console.log(`ffmpegProcess exited with code ${code} and signal ${signal}`);
    ffmpegProcess = null;
    if (code !== 0) {
      res.send(JSON.stringify({ success: false, result: 'Error al detener la grabación' }));
    } else {
      res.send(JSON.stringify({ success: true, result: `Archivo guardado: ${videoPath}` }));
    }
  });

  ffmpegProcess.on('error', (err) => {
    console.log('ffmpegProcess error: ', err);
  });
});

app.use(range());

app.get('/video/:name', (req, res) => {
  const videoName = req.params.name;
  const videoPath = path.join(__dirname, `./images/${videoName}.mp4`);

  if (fs.existsSync(videoPath)) {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } else {
    res.send(JSON.stringify({ success: false, result: 'El archivo de video no existe' }));
  }
});

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});