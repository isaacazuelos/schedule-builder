declare module 'javascript-lp-solver' {
  interface LpModel {
    optimize: string;
    opType: 'min' | 'max';
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, 1>;
    binaries?: Record<string, 1>;
  }

  interface LpResult {
    feasible: boolean;
    result: number;
    [varName: string]: number | boolean;
  }

  const solver: {
    Solve(model: LpModel): LpResult;
  };

  export default solver;
}
