import { useState } from "react";
import { Dimensions, Modal, Pressable, Text, TextInput, View } from "react-native";
import { GraphCanvas } from "@/components/GraphCanvas";
import { evaluateExpression } from "@/lib/expressionEvaluator";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { ColorTokens } from "@/theme";

type Mode = "calculate" | "graph";
type AngleMode = "deg" | "rad";

const KEY_ROWS: string[][] = [
  ["sin(", "cos(", "tan(", "^", "AC"],
  ["ln(", "log(", "sqrt(", "(", ")"],
  ["7", "8", "9", "/", "DEL"],
  ["4", "5", "6", "*", "pi"],
  ["1", "2", "3", "-", "e"],
  ["0", ".", "=", "+", ""],
];

function createStyles(colors: ColorTokens) {
  return {
    launchButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    launchButtonText: { fontSize: 18 },
    modalContainer: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modeToggle: { flexDirection: "row", gap: 8 },
    modeButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeButtonActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    modeButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    modeButtonTextActive: { color: colors.primary },
    closeButton: { color: colors.textMuted, fontSize: 22, paddingHorizontal: 8 },
    display: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 80,
      justifyContent: "flex-end",
    },
    displayInput: { color: colors.text, fontSize: 22, textAlign: "right" },
    displayResult: { color: colors.primary, fontSize: 16, textAlign: "right", marginTop: 6 },
    angleToggle: {
      alignSelf: "flex-end",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 12,
    },
    angleToggleText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
    keyRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    key: {
      flex: 1,
      aspectRatio: 1.4,
      backgroundColor: colors.surface,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyEmpty: { backgroundColor: "transparent", borderWidth: 0 },
    keyEquals: { backgroundColor: colors.primary, borderColor: colors.primary },
    keyText: { color: colors.text, fontSize: 15, fontWeight: "600" },
    graphInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    graphY: { color: colors.text, fontSize: 16, fontWeight: "700" },
    graphInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
    },
    graphCanvasWrap: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: "center",
      overflow: "hidden",
      marginBottom: 12,
    },
    graphControls: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
    graphButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    graphButtonText: { color: colors.text, fontSize: 12, fontWeight: "600" },
    graphHint: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  } as const;
}

function CalculatorPad() {
  const { styles } = useThemedStyles(createStyles);
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  function handleKey(key: string) {
    if (!key) return;
    if (key === "AC") {
      setInput("");
      setResult(null);
      return;
    }
    if (key === "DEL") {
      setInput((s) => s.slice(0, -1));
      return;
    }
    if (key === "=") {
      try {
        const value = evaluateExpression(input, {}, angleMode);
        setResult(String(Math.round(value * 1e10) / 1e10));
      } catch {
        setResult("Error");
      }
      return;
    }
    setResult(null);
    setInput((s) => s + key);
  }

  return (
    <View>
      <View style={styles.display}>
        <Text style={styles.displayInput} numberOfLines={2}>
          {input || "0"}
        </Text>
        {result != null && <Text style={styles.displayResult}>= {result}</Text>}
      </View>

      <Pressable style={styles.angleToggle} onPress={() => setAngleMode((m) => (m === "deg" ? "rad" : "deg"))}>
        <Text style={styles.angleToggleText}>{angleMode.toUpperCase()}</Text>
      </Pressable>

      {KEY_ROWS.map((row, i) => (
        <View key={i} style={styles.keyRow}>
          {row.map((key, j) => (
            <Pressable
              key={j}
              disabled={!key}
              style={[styles.key, !key && styles.keyEmpty, key === "=" && styles.keyEquals]}
              onPress={() => handleKey(key)}
            >
              <Text style={styles.keyText}>{key.replace("(", "")}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function GraphPad() {
  const { styles, colors } = useThemedStyles(createStyles);
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  const [expression, setExpression] = useState("x^2");
  const [xRange, setXRange] = useState<[number, number]>([-10, 10]);
  const canvasWidth = Math.min(Dimensions.get("window").width - 48, 400);

  function zoom(factor: number) {
    const [min, max] = xRange;
    const center = (min + max) / 2;
    const halfWidth = ((max - min) / 2) * factor;
    setXRange([center - halfWidth, center + halfWidth]);
  }

  return (
    <View>
      <View style={styles.graphInputRow}>
        <Text style={styles.graphY}>y =</Text>
        <TextInput
          style={styles.graphInput}
          value={expression}
          onChangeText={setExpression}
          placeholder="x^2"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.graphCanvasWrap}>
        <GraphCanvas
          expression={expression}
          angleMode={angleMode}
          xRange={xRange}
          onXRangeChange={setXRange}
          width={canvasWidth}
          height={240}
        />
      </View>

      <View style={styles.graphControls}>
        <Pressable style={styles.graphButton} onPress={() => zoom(0.7)}>
          <Text style={styles.graphButtonText}>Zoom in</Text>
        </Pressable>
        <Pressable style={styles.graphButton} onPress={() => zoom(1 / 0.7)}>
          <Text style={styles.graphButtonText}>Zoom out</Text>
        </Pressable>
        <Pressable style={styles.graphButton} onPress={() => setXRange([-10, 10])}>
          <Text style={styles.graphButtonText}>Reset</Text>
        </Pressable>
        <Pressable style={styles.graphButton} onPress={() => setAngleMode((m) => (m === "deg" ? "rad" : "deg"))}>
          <Text style={styles.graphButtonText}>{angleMode.toUpperCase()}</Text>
        </Pressable>
      </View>
      <Text style={styles.graphHint}>Drag the graph to pan.</Text>
    </View>
  );
}

export function GraphingCalculatorButton() {
  const { styles } = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("calculate");

  return (
    <>
      <Pressable style={styles.launchButton} onPress={() => setOpen(true)}>
        <Text style={styles.launchButtonText}>🧮</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeButton, mode === "calculate" && styles.modeButtonActive]}
                onPress={() => setMode("calculate")}
              >
                <Text style={[styles.modeButtonText, mode === "calculate" && styles.modeButtonTextActive]}>
                  Calculate
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === "graph" && styles.modeButtonActive]}
                onPress={() => setMode("graph")}
              >
                <Text style={[styles.modeButtonText, mode === "graph" && styles.modeButtonTextActive]}>Graph</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </Pressable>
          </View>
          {mode === "calculate" ? <CalculatorPad /> : <GraphPad />}
        </View>
      </Modal>
    </>
  );
}
