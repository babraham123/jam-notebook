import '@tensorflow/tfjs-backend-webgl';
import * as mobilenet from '@tensorflow-models/mobilenet';

const img = document.createElement('img');
img.crossOrigin = 'anonymous'
img.src = "https://upload.wikimedia.org/wikipedia/commons/b/b1/Hot_dog_with_mustard.png";

// Load the model.
const model = await mobilenet.load();

// Classify the image.
const predictions = await model.classify(img);
