import { Story } from "inkjs";

export interface StoryOutput {
  text: string;
  choices: Array<{ index: number; text: string }>;
}

/**
 * Wrapper around inkjs Story runtime.
 * Provides a simplified API for the VerbEngine game loop.
 */
export class InkEngine {
  private story: Story | null = null;

  constructor() {
    // Empty — story is loaded later via loadStory()
  }

  /**
   * Initializes the inkjs Story from a compiled Ink JSON string.
   * NOTE: inkjs expects compiled JSON (output of the Ink compiler),
   * not raw .ink source text.
   */
  loadStory(compiledJson: string): void {
    this.story = new Story(compiledJson);
  }

  /**
   * Continues the story and returns the current text plus available choices.
   * Gathers all continuous text until a choice point or end is reached.
   */
  continueStory(): StoryOutput {
    const story = this.getStory();

    let text = "";
    while (story.canContinue) {
      text += story.Continue();
    }

    const choices = story.currentChoices.map((choice) => ({
      index: choice.index,
      text: choice.text,
    }));

    return { text: text.trim(), choices };
  }

  /**
   * Selects a choice by its index, advancing the story.
   */
  chooseChoice(index: number): void {
    const story = this.getStory();
    story.ChooseChoiceIndex(index);
  }

  /**
   * Reads an Ink variable by name.
   * Returns null if the variable does not exist.
   */
  getVariable(name: string): string | number | boolean | null {
    const story = this.getStory();
    const value = story.variablesState.$(name);
    if (value === undefined) {
      return null;
    }
    return value as string | number | boolean;
  }

  /**
   * Sets an Ink variable by name.
   */
  setVariable(name: string, value: string | number | boolean): void {
    const story = this.getStory();
    story.variablesState.$(name, value);
  }

  /**
   * Returns tags on the current line.
   */
  getCurrentTags(): string[] {
    const story = this.getStory();
    return story.currentTags ?? [];
  }

  /**
   * Whether the story can continue (more content to read).
   */
  get canContinue(): boolean {
    return this.story !== null && this.story.canContinue;
  }

  /**
   * Whether the story has reached -> END.
   */
  get isEnded(): boolean {
    if (this.story === null) {
      return false;
    }
    // The story is ended when it cannot continue and has no choices
    return !this.story.canContinue && this.story.currentChoices.length === 0;
  }

  /**
   * Returns the story instance, throwing if not yet loaded.
   */
  private getStory(): Story {
    if (this.story === null) {
      throw new Error("Story not loaded. Call loadStory() first.");
    }
    return this.story;
  }
}
