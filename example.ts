import { JuliusClient } from './index';

const juliusClient = new JuliusClient();

juliusClient.on('RECOGOUT', data => {
  const ranks = data.map(({ rank }) => rank);
  const best = data.find(({ rank }) => rank === Math.min(...ranks));
  const words = best?.whypo
    .filter(({ phone }) => phone !== 'silB' && phone !== 'silE')
    .map(word => `${word.word}(${word.cm})`);
  console.log(`${best?.score.toString(10) ?? ''}\t${words?.join('') ?? ''}`);
});
