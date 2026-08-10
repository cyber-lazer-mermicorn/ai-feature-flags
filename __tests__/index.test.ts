import { getAIModel } from '../lib/flags';

describe('getAIModel', () => {
  it('should be defined', () => {
    expect(getAIModel).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof getAIModel).toBe('function');
  });
});
