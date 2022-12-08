import '../libraries/tfjs.js';
import metadata from '../cnn_model/metadata.json' assert {type: 'json'};

const SANDBOX_CONFIG = {
    MODEL_URL: 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json',
    MAX_LEN: 1000,
};
const PAD_INDEX = 0;  // Index of the padding character.

/**
 * Loads the CNN model.
 * 
 * @returns The tensorflow model.
 */
async function loadModel() {
    return await tf.loadLayersModel(SANDBOX_CONFIG.MODEL_URL);
}

/**
 * Parse the review string into a fixed-length sequence and generate a prediction score.
 * 
 * @param {string} review   The content of the review.
 * @returns                 A number for the prediction score between 0 and 1.
 *                              0: Negative
 *                              1: Positive
 */
function predict(review) {
    // Trim and split the review into an array of words.
    const words = review.trim().toLowerCase().replace(/(\.|\,|\!)/g, '').split(' ');
    // Tokenize the words into word indices.
    const sequence = words
        .filter(word => word in metadata.word_index)
        .map(word => metadata.index_from + metadata.word_index[word]);
    // Predict the review score by creating a TensorFlow object with the sequence.
    const paddedSequence = padSequences([sequence], SANDBOX_CONFIG.MAX_LEN);
    const input = tf.tensor2d(paddedSequence, [1, SANDBOX_CONFIG.MAX_LEN]);
 
    const predictOut = model.predict(input);
    const score = predictOut.dataSync()[0];
    predictOut.dispose();
    return score;
}

/**
 * Make each sequence fixed-length. Add preceeding 0s for shorter sequences.
 * 
 * @param {Array<number>} sequences     Array of the raw sequences.
 * @param {number} maxLen               The cut off length for sequences.
 * @returns                             Array of the fixed-length sequences.
 */
function padSequences(sequences, maxLen) {
  return sequences.map(seq => {
    // Perform truncation.
    if (seq.length > maxLen) {
        seq.splice(0, seq.length - maxLen);
    }

    // Perform padding.
    if (seq.length < maxLen) {
      const pad = [];
      for (let i = 0; i < maxLen - seq.length; ++i) {
        pad.push(PAD_INDEX);
      }
      seq = pad.concat(seq);
    }

    return seq;
  });
}

const model = await loadModel();

// Listen to messages sent by script living outside of the sandbox.
window.addEventListener('message', function (event) {
    const {name, pageNumber, reviews} = event.data;

    if (name === 'analyzeReviews') {
        window.parent.postMessage({
            name: 'analyzeReviewsFinished',
            pageNumber,
            reviews: reviews.map(review => {
                const proScore = predict(review.pros) * 5;
                const conScore = predict(review.cons) * 5;
                return {
                    ...review,
                    proScore,
                    conScore,
                    avgScore: (proScore + conScore) / 2,
                };
            }),
        }, '*');
    }
});

window.parent.postMessage({name: 'modelLoaded'}, '*');