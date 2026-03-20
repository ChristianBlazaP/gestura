import * as tf from '@tensorflow/tfjs';

export async function loadAllModels() {
  await tf.setBackend("webgl");

  const asl = await tf.loadLayersModel('/model-asl/model.json');
  const numbers = await tf.loadLayersModel('/model-numbers/model.json');
  const basic = await tf.loadLayersModel('/model-basic/model.json');

  return { asl, numbers, basic };
}