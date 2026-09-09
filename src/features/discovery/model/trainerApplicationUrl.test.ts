import { trainerApplicationUrl } from "./trainerApplicationUrl";

describe("trainer application link", () => {
  it("accepts only a configured HTTPS Google Form responder URL", () => {
    const url = "https://docs.google.com/forms/d/e/form-id/viewform?usp=sharing";
    expect(trainerApplicationUrl(url)).toBe(url);
  });
  it.each([undefined, "", "javascript:alert(1)", "https://docs.google.com.evil.test/forms/d/e/id/viewform",
    "https://evil@docs.google.com/forms/d/e/id/viewform", "https://docs.google.com/forms/d/id/edit",
    "http://docs.google.com/forms/d/e/id/viewform", "https://docs.google.com:444/forms/d/e/id/viewform"])("rejects missing, unsafe or non-responder links: %s", (url) => {
      expect(trainerApplicationUrl(url)).toBeNull();
    });
});
