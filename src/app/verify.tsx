import { wordlist } from '@crypto/mnemonic';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { getDraft, nextBackup } from '@/lib/draft';

// ponytail: Math.random is fine here; which words we quiz reveals nothing.
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** 3 random positions, each with the right word and 3 decoys that aren't in the phrase. */
function makeQuiz(words: string[]) {
  const positions = shuffle(words.map((_, i) => i)).slice(0, 3).sort((a, b) => a - b);
  return positions.map((i) => {
    const decoys = new Set<string>();
    while (decoys.size < 3) {
      const w = pick(wordlist as string[]);
      if (!words.includes(w)) decoys.add(w);
    }
    return { n: i + 1, answer: words[i], choices: shuffle([words[i], ...decoys]) };
  });
}

export default function Verify() {
  usePreventScreenCapture();
  const router = useRouter();
  const words = getDraft().mnemonic!.split(' ');
  const [quiz] = useState(() => makeQuiz(words));
  const [picked, setPicked] = useState<Record<number, string>>({});
  const done = quiz.every((q) => picked[q.n] === q.answer);
  const wrong = quiz.some((q) => picked[q.n] && picked[q.n] !== q.answer);

  return (
    <Screen>
      <Text style={[Type.body, { color: Colors.inkSoft }]}>Without looking back, pick these 3 words from your paper.</Text>
      {quiz.map((q) => (
        <View key={q.n} style={{ gap: Spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={`Word ${q.n}`}>
          <Text style={Type.heading}>Word #{q.n}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {q.choices.map((c) => {
              const sel = picked[q.n] === c;
              const bad = sel && c !== q.answer;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  onPress={() => setPicked({ ...picked, [q.n]: c })}
                  style={{
                    width: '48.5%',
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderRadius: Radius.md,
                    borderWidth: 2,
                    borderColor: sel ? (bad ? Colors.negative : Colors.primary) : Colors.border,
                    backgroundColor: sel ? (bad ? Colors.negativeSoft : Colors.primary) : Colors.card,
                  }}>
                  <Text style={[Type.body, { color: sel && !bad ? Colors.white : Colors.ink }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Text style={[Type.small, { color: done ? Colors.positive : wrong ? Colors.negative : Colors.inkSoft }]}>
        {done ? 'All 3 match. Your paper is good.' : wrong ? "That one doesn't match. Check your paper, or go back and see the words again." : 'We never store the phrase. This is the only check.'}
      </Text>
      <View style={{ flex: 1 }} />
      <Button title="Continue" disabled={!done} onPress={() => nextBackup(router, 'phrase')} />
    </Screen>
  );
}
