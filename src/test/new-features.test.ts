import { describe, expect, it } from "vitest";
import { matchRecommendations } from "@/lib/recommendations";
import { reportCodeSchema, resolveCodeSchema } from "@/lib/code-issue-schema";
const id = "11111111-1111-4111-8111-111111111111";
describe("code issue actions", () => {
  it("accepts buyer issue descriptions with an order and delivered code", () => {
    expect(reportCodeSchema.parse({orderId:id,codeId:id,description:"Code does not activate"}).codeId).toBe(id);
    expect(reportCodeSchema.safeParse({orderId:id,codeId:id,description:""}).success).toBe(false);
  });
  it("seller may review, replace or decline, but not alter payment", () => {
    for(const action of ["reviewing","replaced","rejected"]) expect(resolveCodeSchema.parse({issueId:id,action,note:"Checked"}).action).toBe(action);
    expect(resolveCodeSchema.safeParse({issueId:id,action:"refund",note:"Checked"}).success).toBe(false);
  });
});
describe("catalog-grounded AI suggestions", () => {
  it("only returns real catalog products and removes duplicate suggestions", () => {
    expect(matchRecommendations([{productId:id,reason:"Matches"},{productId:"invented",reason:"Fake"},{productId:id,reason:"Again"}],[{id}])).toEqual([{product:{id},reason:"Matches"}]);
  });
});