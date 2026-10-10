import { FormatString } from "../yemot.interface";

describe('FormatString', () => {
  it('should replace placeholders with values', () => {
    const result = FormatString("Hello {0}, you have {1} new messages.", ["John", "5"]);
    expect(result).toBe("Hello John, you have 5 new messages.");
  });

  it('should not replace anything if no placeholders', () => {
    const result = FormatString("Hello World!", ["test"]);
    expect(result).toBe("Hello World!");
  });
});
