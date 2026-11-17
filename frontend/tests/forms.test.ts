import { expect, it } from "vitest";
import { getFailingPasswordMessages, isPasswordValid } from "@/utils/passwordRules";
import { fieldErrorMessages, parseApiError } from "@/utils/apiError";
import { getReaction } from "@/utils/reaction";
import { pickListText } from "@/utils/listText";

it.each([
  ["Abcdef1", false], ["Abcdefg1", true], ["ABCDEFG1", true],
  ["ğabcdef1", false], ["İabcdef1", false], ["Abcdefgh", false],
])("validates %s against the registration rules", (password, valid) => {
  expect(isPasswordValid(password)).toBe(valid);
});

it("shows the missing password requirements in checklist order", () => {
  expect(getFailingPasswordMessages("abc", key => key)).toEqual([
    "auth.passwordRuleLength", "auth.passwordRuleUppercase", "auth.passwordRuleDigit",
  ]);
});

it("maps server validation messages to the corresponding form fields", () => {
  const errors = { Password: ["Too short", "Digit required"], Email: ["Invalid"] };
  const problem = parseApiError({ response: { data: { title: "Invalid form", errors } } }, "Offline");
  expect(problem.title).toBe("Invalid form");
  expect(problem.firstFieldMessage).toBe("Too short");
  expect(fieldErrorMessages(problem.fieldErrors, "password")).toEqual(errors.Password);
  expect(fieldErrorMessages(problem.fieldErrors, "username")).toEqual([]);
});

it("uses the supplied fallback for a network error", () => {
  expect(parseApiError(new Error("disconnected"), "Offline")).toEqual({
    title: "Offline", fieldErrors: {}, firstFieldMessage: undefined,
  });
});

it("prefers the current reaction and supports older movie responses", () => {
  expect(getReaction({ currentUserReaction: "Dislike", isLikedByCurrentUser: true })).toBe("Dislike");
  expect(getReaction({ isLikedByCurrentUser: true })).toBe("Like");
  expect(getReaction({})).toBeNull();
});

it("uses the selected locale and falls back when its text is blank", () => {
  expect(pickListText("Liste", "List", "tr-TR")).toBe("Liste");
  expect(pickListText(" ", "List", "tr")).toBe("List");
  expect(pickListText("Liste", "", "en")).toBe("Liste");
});
