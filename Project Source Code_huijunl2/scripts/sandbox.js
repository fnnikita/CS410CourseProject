import './tfjs.js';

const SANDBOX_CONFIG = {
    MODEL: 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json',
    METADATA: 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/metadata.json'
};
 
const model = await tf.loadLayersModel(SANDBOX_CONFIG.MODEL);
const metadata = await fetch(SANDBOX_CONFIG.METADATA).then(response => response.json());

console.log(model);
console.log(metadata);
const wordIndex = metadata.word_index['hello'] + metadata.index_from;
console.log(wordIndex);