export type SimpleToken = {
  address: string;
  decimals: number;
};

export type Token = SimpleToken & {
  symbol: string;
  name: string;
};
