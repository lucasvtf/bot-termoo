CREATE TABLE IF NOT EXISTS usuarios (
  id          BIGINT PRIMARY KEY,
  username    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apelido no servidor / nome global; atualizado a cada /termo. Ranking cai pro username se for NULL.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;

-- Um registro por (data, modo). palavras: 1 no Termo, 2 no Dueto, 4 no Quarteto.
CREATE TABLE IF NOT EXISTS termo_dias (
  id          SERIAL PRIMARY KEY,
  data        DATE NOT NULL,
  modo        TEXT NOT NULL DEFAULT 'termo',
  palavras    TEXT[] NOT NULL,
  anunciado   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marca se o anúncio da meia-noite (palavra + resumo) desse dia já foi postado.
ALTER TABLE termo_dias ADD COLUMN IF NOT EXISTS anunciado BOOLEAN NOT NULL DEFAULT FALSE;

-- Migração de bancos antigos (coluna única `palavra`, UNIQUE (data)) → modos + palavras[].
-- A coluna `palavra` fica (opcional, sem uso) só pra não quebrar o container antigo durante o deploy;
-- pode ser removida numa versão futura.
ALTER TABLE termo_dias ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'termo';
ALTER TABLE termo_dias ADD COLUMN IF NOT EXISTS palavras TEXT[];
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'termo_dias' AND column_name = 'palavra'
  ) THEN
    UPDATE termo_dias SET palavras = ARRAY[palavra] WHERE palavras IS NULL;
    ALTER TABLE termo_dias ALTER COLUMN palavra DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE termo_dias ALTER COLUMN palavras SET NOT NULL;
ALTER TABLE termo_dias DROP CONSTRAINT IF EXISTS termo_dias_data_key;
CREATE UNIQUE INDEX IF NOT EXISTS termo_dias_data_modo_key ON termo_dias (data, modo);

CREATE TABLE IF NOT EXISTS termo_partidas (
  id             SERIAL PRIMARY KEY,
  usuario_id     BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia_id         INT NOT NULL REFERENCES termo_dias(id) ON DELETE CASCADE,
  tentativas     JSONB NOT NULL DEFAULT '[]',
  num_tentativas INT NOT NULL DEFAULT 0,
  venceu         BOOLEAN NOT NULL DEFAULT FALSE,
  finalizado     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, dia_id)
);

CREATE INDEX IF NOT EXISTS termo_partidas_usuario_idx ON termo_partidas (usuario_id);

CREATE TABLE IF NOT EXISTS termo_banidas (
  palavra     TEXT PRIMARY KEY,
  banida_por  BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
