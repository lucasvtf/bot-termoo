CREATE TABLE IF NOT EXISTS usuarios (
  id          BIGINT PRIMARY KEY,
  username    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apelido no servidor / nome global; atualizado a cada /termo. Ranking cai pro username se for NULL.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;

CREATE TABLE IF NOT EXISTS termo_dias (
  id          SERIAL PRIMARY KEY,
  data        DATE NOT NULL UNIQUE,
  palavra     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marca se o anúncio da meia-noite (palavra + resumo) desse dia já foi postado.
ALTER TABLE termo_dias ADD COLUMN IF NOT EXISTS anunciado BOOLEAN NOT NULL DEFAULT FALSE;

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
