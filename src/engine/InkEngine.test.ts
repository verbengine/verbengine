import { describe, it, expect, beforeEach } from "vitest";
import { InkEngine } from "./InkEngine";

/**
 * Compiled Ink JSON for the following story:
 *
 * VAR score = 0
 * VAR has_key = false
 *
 * -> start
 *
 * === start ===
 * # tag_start
 * You are in a room.
 * + [Look around]
 *   ~ score = 10
 *   You see a key on the table.
 *   ++ [Take the key]
 *     ~ has_key = true
 *     You pick up the key.
 *     -> hallway
 *   ++ [Leave it] -> start
 * + [Go to hallway] -> hallway
 *
 * === hallway ===
 * # tag_hallway
 * You are in a hallway.
 * {has_key:
 *   + [Open the door with the key] -> ending
 * }
 * + [Go back] -> start
 *
 * === ending ===
 * # tag_ending
 * You opened the door and escaped! Your score is {score}.
 * -> END
 */
const TEST_STORY_JSON = '{"inkVersion":21,"root":[[{"->":"start"},["done",{"#n":"g-0"}],null],"done",{"start":[["#","^tag_start","/#","^You are in a room.","\\n","ev","str","^Look around","/str","/ev",{"*":".^.c-0","flg":4},"ev","str","^Go to hallway","/str","/ev",{"*":".^.c-1","flg":4},{"c-0":["\\n","ev",10,"/ev",{"VAR=":"score","re":true},"^You see a key on the table.","\\n",["ev","str","^Take the key","/str","/ev",{"*":".^.c-0","flg":4},"ev","str","^Leave it","/str","/ev",{"*":".^.c-1","flg":4},{"c-0":["\\n","ev",true,"/ev",{"VAR=":"has_key","re":true},"^You pick up the key.","\\n",{"->":"hallway"},null],"c-1":["^ ",{"->":"start"},"\\n",null]}],null],"c-1":["^ ",{"->":"hallway"},"\\n",null]}],null],"hallway":[["#","^tag_hallway","/#","^You are in a hallway.","\\n","ev",{"VAR?":"has_key"},"/ev",[{"->":".^.b","c":true},{"b":["\\n","ev","str","^Open the door with the key","/str","/ev",{"*":".^.c-0","flg":4},{"->":".^.^.^.9"},{"c-0":["^ ",{"->":"ending"},"\\n",null]}]}],"nop","\\n","ev","str","^Go back","/str","/ev",{"*":".^.c-0","flg":4},{"c-0":["^ ",{"->":"start"},"\\n",null]}],null],"ending":["#","^tag_ending","/#","^You opened the door and escaped! Your score is ","ev",{"VAR?":"score"},"out","/ev","^.","\\n","end",null],"global decl":["ev",0,{"VAR=":"score"},false,{"VAR=":"has_key"},"/ev","end",null]}],"listDefs":{}}';

describe("InkEngine", () => {
  let engine: InkEngine;

  beforeEach(() => {
    engine = new InkEngine();
  });

  describe("constructor", () => {
    it("should create an engine without a loaded story", () => {
      expect(engine.canContinue).toBe(false);
      expect(engine.isEnded).toBe(false);
    });
  });

  describe("loadStory", () => {
    it("should load a compiled Ink JSON string", () => {
      engine.loadStory(TEST_STORY_JSON);
      expect(engine.canContinue).toBe(true);
    });

    it("should throw on invalid JSON", () => {
      expect(() => engine.loadStory("not valid json")).toThrow();
    });
  });

  describe("continueStory", () => {
    beforeEach(() => {
      engine.loadStory(TEST_STORY_JSON);
    });

    it("should return initial text and choices", () => {
      const output = engine.continueStory();

      expect(output.text).toContain("You are in a room.");
      expect(output.choices).toHaveLength(2);
      expect(output.choices[0].text).toBe("Look around");
      expect(output.choices[1].text).toBe("Go to hallway");
    });

    it("should throw if story not loaded", () => {
      const freshEngine = new InkEngine();
      expect(() => freshEngine.continueStory()).toThrow(
        "Story not loaded. Call loadStory() first."
      );
    });
  });

  describe("chooseChoice", () => {
    beforeEach(() => {
      engine.loadStory(TEST_STORY_JSON);
    });

    it("should advance the story after choosing", () => {
      engine.continueStory();

      // Choose "Look around" (index 0)
      engine.chooseChoice(0);
      const output = engine.continueStory();

      expect(output.text).toContain("You see a key on the table.");
      expect(output.choices).toHaveLength(2);
      expect(output.choices[0].text).toBe("Take the key");
      expect(output.choices[1].text).toBe("Leave it");
    });
  });

  describe("getVariable / setVariable", () => {
    beforeEach(() => {
      engine.loadStory(TEST_STORY_JSON);
    });

    it("should read initial variable values", () => {
      expect(engine.getVariable("score")).toBe(0);
      expect(engine.getVariable("has_key")).toBe(false);
    });

    it("should set and read variable values", () => {
      engine.setVariable("score", 42);
      expect(engine.getVariable("score")).toBe(42);

      engine.setVariable("has_key", true);
      expect(engine.getVariable("has_key")).toBe(true);
    });

    it("should reflect variable changes from story choices", () => {
      engine.continueStory();
      engine.chooseChoice(0); // "Look around" sets score = 10
      engine.continueStory();

      expect(engine.getVariable("score")).toBe(10);
    });
  });

  describe("getCurrentTags", () => {
    beforeEach(() => {
      engine.loadStory(TEST_STORY_JSON);
    });

    it("should return tags from the current line", () => {
      engine.continueStory();
      const tags = engine.getCurrentTags();
      expect(tags).toContain("tag_start");
    });
  });

  describe("canContinue", () => {
    it("should be false before loading a story", () => {
      expect(engine.canContinue).toBe(false);
    });

    it("should be true after loading, before continuing", () => {
      engine.loadStory(TEST_STORY_JSON);
      expect(engine.canContinue).toBe(true);
    });

    it("should be false at a choice point", () => {
      engine.loadStory(TEST_STORY_JSON);
      engine.continueStory();
      expect(engine.canContinue).toBe(false);
    });
  });

  describe("isEnded", () => {
    it("should be false before loading", () => {
      expect(engine.isEnded).toBe(false);
    });

    it("should be false during active story", () => {
      engine.loadStory(TEST_STORY_JSON);
      engine.continueStory();
      expect(engine.isEnded).toBe(false);
    });

    it("should be true after reaching END", () => {
      engine.loadStory(TEST_STORY_JSON);

      // Navigate: start -> Look around -> Take the key -> hallway -> Open door -> ending
      engine.continueStory();
      engine.chooseChoice(0); // Look around
      engine.continueStory();
      engine.chooseChoice(0); // Take the key
      engine.continueStory();
      engine.chooseChoice(0); // Open the door with the key
      const final = engine.continueStory();

      expect(final.text).toContain("You opened the door and escaped!");
      expect(final.text).toContain("10"); // score value
      expect(final.choices).toHaveLength(0);
      expect(engine.isEnded).toBe(true);
    });
  });

  describe("full playthrough", () => {
    it("should complete an entire story path", () => {
      engine.loadStory(TEST_STORY_JSON);

      // 1. Start
      const start = engine.continueStory();
      expect(start.text).toContain("You are in a room.");
      expect(start.choices).toHaveLength(2);

      // 2. Go to hallway without key
      engine.chooseChoice(1); // "Go to hallway"
      const hallwayNoKey = engine.continueStory();
      expect(hallwayNoKey.text).toContain("You are in a hallway.");
      // Without key, only "Go back" is available
      expect(hallwayNoKey.choices).toHaveLength(1);
      expect(hallwayNoKey.choices[0].text).toBe("Go back");

      // 3. Go back to start
      engine.chooseChoice(0); // "Go back"
      const startAgain = engine.continueStory();
      expect(startAgain.text).toContain("You are in a room.");

      // 4. Look around, take the key
      engine.chooseChoice(0); // "Look around"
      engine.continueStory();
      engine.chooseChoice(0); // "Take the key"
      const hallwayWithKey = engine.continueStory();
      expect(hallwayWithKey.text).toContain("You are in a hallway.");
      // With key, "Open the door" is available
      expect(hallwayWithKey.choices.length).toBeGreaterThanOrEqual(2);

      // 5. Open the door
      const openDoorChoice = hallwayWithKey.choices.find((c) =>
        c.text.includes("Open the door")
      );
      expect(openDoorChoice).toBeDefined();
      engine.chooseChoice(openDoorChoice!.index);

      const ending = engine.continueStory();
      expect(ending.text).toContain("escaped");
      expect(engine.isEnded).toBe(true);
    });
  });
});
