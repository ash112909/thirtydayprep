// Small recursive-descent parser/evaluator for the in-app graphing
// calculator. Deliberately not using eval()/Function() — this also lets us
// support calculator-specific syntax (implicit multiplication like "2x",
// degree-mode trig) that JS expressions don't have anyway.

type TokenType = "num" | "ident" | "op" | "lparen" | "rparen";
interface Token {
  type: TokenType;
  value: string;
}

const FUNCTION_NAMES = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "sqrt", "abs"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const s = input.replace(/\s+/g, "");
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push({ type: "num", value: s.slice(i, j) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      tokens.push({ type: "ident", value: s.slice(i, j) });
      i = j;
    } else if (c === "(") {
      tokens.push({ type: "lparen", value: c });
      i++;
    } else if (c === ")") {
      tokens.push({ type: "rparen", value: c });
      i++;
    } else if ("+-*/^".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
    } else {
      throw new Error(`Unexpected character: ${c}`);
    }
  }
  return tokens;
}

// Inserts explicit '*' between adjacent tokens that imply multiplication
// (e.g. "2x" -> "2*x", "2(x+1)" -> "2*(x+1)", "xsin(x)" -> "x*sin(x)") so
// students can type the way they would on a real calculator.
function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (const t of tokens) {
    if (result.length) {
      const prev = result[result.length - 1];
      const prevEndsValue =
        prev.type === "num" || prev.type === "rparen" || (prev.type === "ident" && !FUNCTION_NAMES.has(prev.value));
      const nextStartsValue = t.type === "num" || t.type === "lparen" || t.type === "ident";
      if (prevEndsValue && nextStartsValue) {
        result.push({ type: "op", value: "*" });
      }
    }
    result.push(t);
  }
  return result;
}

class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private variables: Record<string, number>,
    private angleMode: "deg" | "rad",
  ) {}

  parse(): number {
    const value = this.parseExpr();
    if (this.pos < this.tokens.length) throw new Error("Unexpected token in expression");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.tokens[this.pos++].value;
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (this.peek()?.type === "op" && (this.peek()!.value === "*" || this.peek()!.value === "/")) {
      const op = this.tokens[this.pos++].value;
      const rhs = this.parseUnary();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  // Unary +/- binds *looser* than '^', so "-2^2" is -(2^2) = -4, matching
  // standard math convention (and how a TI-84 evaluates it) rather than
  // (-2)^2 = 4.
  private parseUnary(): number {
    if (this.peek()?.type === "op" && (this.peek()!.value === "-" || this.peek()!.value === "+")) {
      const op = this.tokens[this.pos++].value;
      const value = this.parsePower();
      return op === "-" ? -value : value;
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePrimary();
    if (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.pos++;
      const exponent = this.parseUnary(); // right-associative, allows e.g. 2^-3
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parsePrimary(): number {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");

    if (t.type === "num") {
      this.pos++;
      return parseFloat(t.value);
    }

    if (t.type === "lparen") {
      this.pos++;
      const value = this.parseExpr();
      if (this.peek()?.type !== "rparen") throw new Error("Missing closing parenthesis");
      this.pos++;
      return value;
    }

    if (t.type === "ident") {
      const name = t.value.toLowerCase();
      this.pos++;
      if (FUNCTION_NAMES.has(name)) {
        if (this.peek()?.type !== "lparen") throw new Error(`Expected '(' after ${name}`);
        this.pos++;
        const arg = this.parseExpr();
        if (this.peek()?.type !== "rparen") throw new Error("Missing closing parenthesis");
        this.pos++;
        return this.applyFunction(name, arg);
      }
      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;
      if (name in this.variables) return this.variables[name];
      throw new Error(`Unknown identifier: ${name}`);
    }

    throw new Error("Unexpected token");
  }

  private applyFunction(name: string, arg: number): number {
    const toRad = (v: number) => (this.angleMode === "deg" ? (v * Math.PI) / 180 : v);
    const fromRad = (v: number) => (this.angleMode === "deg" ? (v * 180) / Math.PI : v);
    switch (name) {
      case "sin":
        return Math.sin(toRad(arg));
      case "cos":
        return Math.cos(toRad(arg));
      case "tan":
        return Math.tan(toRad(arg));
      case "asin":
        return fromRad(Math.asin(arg));
      case "acos":
        return fromRad(Math.acos(arg));
      case "atan":
        return fromRad(Math.atan(arg));
      case "ln":
        return Math.log(arg);
      case "log":
        return Math.log10(arg);
      case "sqrt":
        return Math.sqrt(arg);
      case "abs":
        return Math.abs(arg);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
}

export function evaluateExpression(
  input: string,
  variables: Record<string, number> = {},
  angleMode: "deg" | "rad" = "deg",
): number {
  if (!input.trim()) throw new Error("Empty expression");
  const tokens = insertImplicitMultiplication(tokenize(input));
  const parser = new Parser(tokens, variables, angleMode);
  const result = parser.parse();
  if (!Number.isFinite(result)) throw new Error("Undefined result");
  return result;
}
