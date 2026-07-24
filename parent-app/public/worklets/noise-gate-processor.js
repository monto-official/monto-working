// Envelope-follower noise gate: mutes audio below a calibrated noise floor,
// with smoothed attack/release so speech isn't clipped or clicky.
class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: 0.02, minValue: 0, maxValue: 1 },
      { name: "attack", defaultValue: 0.35, minValue: 0.001, maxValue: 1 },
      { name: "release", defaultValue: 0.01, minValue: 0.001, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gain = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const threshold = parameters.threshold[0];
    const attack = parameters.attack[0];
    const release = parameters.release[0];

    for (let channel = 0; channel < input.length; channel++) {
      const inCh = input[channel];
      const outCh = output[channel];
      if (!inCh) continue;
      for (let i = 0; i < inCh.length; i++) {
        const sample = inCh[i];
        this.envelope += (Math.abs(sample) - this.envelope) * 0.08;

        const targetGain = this.envelope > threshold ? 1 : 0;
        const coeff = targetGain > this.gain ? attack : release;
        this.gain += (targetGain - this.gain) * coeff;

        outCh[i] = sample * this.gain;
      }
    }
    return true;
  }
}

registerProcessor("noise-gate-processor", NoiseGateProcessor);
