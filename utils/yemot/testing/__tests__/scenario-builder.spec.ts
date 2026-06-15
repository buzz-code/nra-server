import { YemotScenarioBuilder } from '../scenario-builder';

describe('YemotScenarioBuilder', () => {
  it('should build a simple scenario with seed and steps', () => {
    const scenario = new YemotScenarioBuilder('Test')
      .seed('User', [{ id: 1 }])
      .systemAsks(/enter/i)
      .userResponds('123')
      .systemHangsUp(/bye/i)
      .build();

    expect(scenario.name).toBe('Test');
    expect(scenario.seed.User).toEqual([{ id: 1 }]);
    expect(scenario.steps).toHaveLength(2);
    expect(scenario.steps[0].type).toBe('ask_input');
    expect(scenario.steps[0].userResponse).toBe('123');
    expect(scenario.steps[1].type).toBe('hangup_message');
  });

  it('should support systemSends between asks', () => {
    const scenario = new YemotScenarioBuilder('With send')
      .systemAsks(/q1/i)
      .userResponds('1')
      .systemSends(/processing/i)
      .systemAsks(/q2/i)
      .userResponds('2')
      .systemHangsUp()
      .build();

    expect(scenario.steps).toHaveLength(4);
    expect(scenario.steps[0].type).toBe('ask_input');
    expect(scenario.steps[1].type).toBe('send_message');
    expect(scenario.steps[2].type).toBe('ask_input');
    expect(scenario.steps[3].type).toBe('hangup_message');
    expect(scenario.steps[3].skipMessageValidation).toBe(true);
  });

  it('should support confirmation with userConfirms sugar', () => {
    const scenario = new YemotScenarioBuilder('Confirm')
      .systemAsksConfirmation(/are you sure/i)
      .userConfirms(true)
      .systemHangsUp()
      .build();

    expect(scenario.steps[0].type).toBe('confirmation');
    expect(scenario.steps[0].userResponse).toBe('1');
  });

  it('should support confirmation with userResponds', () => {
    const scenario = new YemotScenarioBuilder('Confirm no')
      .systemAsksConfirmation(/sure/i)
      .userResponds('2')
      .systemHangsUp()
      .build();

    expect(scenario.steps[0].userResponse).toBe('2');
  });

  it('should throw if userResponds called without preceding ask', () => {
    const builder = new YemotScenarioBuilder('Bad');
    expect(() => builder.userResponds('123')).toThrow(
      /must follow systemAsks/
    );
  });

  it('should throw if userResponds called after systemSends', () => {
    expect(() => {
      new YemotScenarioBuilder('Bad')
        .systemSends(/msg/i)
        .userResponds('123');
    }).toThrow(/must follow systemAsks/);
  });

  it('should support multiple seed calls', () => {
    const scenario = new YemotScenarioBuilder('Multi seed')
      .seed('User', [{ id: 1 }])
      .seed('Student', [{ id: 100 }])
      .systemHangsUp()
      .build();

    expect(scenario.seed.User).toEqual([{ id: 1 }]);
    expect(scenario.seed.Student).toEqual([{ id: 100 }]);
  });

  it('should support all MessageMatcher types', () => {
    const scenario = new YemotScenarioBuilder('Matchers')
      .systemAsks('exact string')
      .userResponds('1')
      .systemAsks(/regex/i)
      .userResponds('2')
      .systemAsks({ contains: 'sub' })
      .userResponds('3')
      .systemAsks({ startsWith: 'pre' })
      .userResponds('4')
      .systemAsks({ endsWith: 'fix' })
      .userResponds('5')
      .systemAsks((msg) => msg.length > 3)
      .userResponds('6')
      .systemHangsUp()
      .build();

    expect(scenario.steps).toHaveLength(7);
  });
});
