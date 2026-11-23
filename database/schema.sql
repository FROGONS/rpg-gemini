SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE SCHEMA IF NOT EXISTS `rpg_gemini` DEFAULT CHARACTER SET utf8mb4;
USE `rpg_gemini`;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(80) NOT NULL,
  `email` VARCHAR(120) NOT NULL,
  `senha_hash` CHAR(60) NOT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_usuarios_email` (`email` ASC)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `personagens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `nome` VARCHAR(80) NOT NULL,
  `classe` VARCHAR(40) NOT NULL,
  `descricao_visual` TEXT NOT NULL,
  `avatar_url` VARCHAR(255) NULL,
  `status_avatar` ENUM('pendente', 'gerando', 'pronto', 'erro') NOT NULL DEFAULT 'pendente',
  `forca` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `destreza` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `constituicao` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `inteligencia` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `sabedoria` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `carisma` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `vida_maxima` SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `fk_personagens_usuarios_idx` (`usuario_id` ASC),
  CONSTRAINT `fk_personagens_usuarios`
    FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `ck_personagens_atributos` CHECK (
    `forca` BETWEEN 1 AND 20 AND `destreza` BETWEEN 1 AND 20 AND `constituicao` BETWEEN 1 AND 20 AND
    `inteligencia` BETWEEN 1 AND 20 AND `sabedoria` BETWEEN 1 AND 20 AND `carisma` BETWEEN 1 AND 20),
  CONSTRAINT `ck_personagens_vida` CHECK (`vida_maxima` > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `salas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `host_id` INT NOT NULL,
  `mapa_atual_id` INT NULL,
  `codigo` CHAR(6) NOT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `tema` TEXT NOT NULL,
  `tom` VARCHAR(60) NULL,
  `preludio` TEXT NULL,
  `objetivo` TEXT NULL,
  `max_jogadores` TINYINT UNSIGNED NOT NULL DEFAULT 4,
  `status` ENUM('preparando', 'aguardando', 'em_jogo', 'encerrada') NOT NULL DEFAULT 'preparando',
  `criada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_salas_codigo` (`codigo` ASC),
  UNIQUE INDEX `uq_salas_mapa_atual` (`mapa_atual_id` ASC),
  INDEX `fk_salas_usuarios_idx` (`host_id` ASC),
  CONSTRAINT `fk_salas_usuarios`
    FOREIGN KEY (`host_id`)
    REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_salas_mapa_atual`
    FOREIGN KEY (`mapa_atual_id`)
    REFERENCES `mapas_cenarios` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `ck_salas_max_jogadores` CHECK (`max_jogadores` BETWEEN 1 AND 8)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `participacoes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sala_id` INT NOT NULL,
  `personagem_id` INT NOT NULL,
  `vida_atual` SMALLINT NOT NULL,
  `status` ENUM('ativo', 'caido', 'morto', 'saiu') NOT NULL DEFAULT 'ativo',
  `entrou_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_participacoes_sala_personagem` (`sala_id` ASC, `personagem_id` ASC),
  INDEX `fk_participacoes_personagens_idx` (`personagem_id` ASC),
  CONSTRAINT `fk_participacoes_salas`
    FOREIGN KEY (`sala_id`)
    REFERENCES `salas` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_participacoes_personagens`
    FOREIGN KEY (`personagem_id`)
    REFERENCES `personagens` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `ck_participacoes_vida` CHECK (`vida_atual` >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `itens_inventario` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `participacao_id` INT NOT NULL,
  `nome` VARCHAR(80) NOT NULL,
  `descricao` VARCHAR(255) NULL,
  `quantidade` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `obtido_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `fk_itens_participacoes_idx` (`participacao_id` ASC),
  CONSTRAINT `fk_itens_participacoes`
    FOREIGN KEY (`participacao_id`)
    REFERENCES `participacoes` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `ck_itens_quantidade` CHECK (`quantidade` > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `mapas_cenarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sala_id` INT NOT NULL,
  `mapa_pai_id` INT NULL,
  `ordem` SMALLINT UNSIGNED NOT NULL,
  `nome` VARCHAR(120) NOT NULL,
  `resumo` VARCHAR(255) NULL,
  `descricao` TEXT NULL,
  `prompt_imagem` TEXT NULL,
  `imagem_url` VARCHAR(255) NULL,
  `status_imagem` ENUM('pendente', 'gerando', 'pronta', 'erro') NOT NULL DEFAULT 'pendente',
  `visitado_em` DATETIME NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_mapas_sala_ordem` (`sala_id` ASC, `ordem` ASC),
  INDEX `fk_mapas_mapa_pai_idx` (`mapa_pai_id` ASC),
  CONSTRAINT `fk_mapas_salas`
    FOREIGN KEY (`sala_id`)
    REFERENCES `salas` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mapas_mapa_pai`
    FOREIGN KEY (`mapa_pai_id`)
    REFERENCES `mapas_cenarios` (`id`)
    ON DELETE SET NULL
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `npcs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sala_id` INT NOT NULL,
  `mapa_id` INT NULL,
  `nome` VARCHAR(80) NOT NULL,
  `descricao` TEXT NULL,
  `personalidade` TEXT NULL,
  `atitude` ENUM('aliado', 'neutro', 'hostil') NOT NULL DEFAULT 'neutro',
  `vida_atual` SMALLINT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `fk_npcs_salas_idx` (`sala_id` ASC),
  INDEX `fk_npcs_mapas_idx` (`mapa_id` ASC),
  CONSTRAINT `fk_npcs_salas`
    FOREIGN KEY (`sala_id`)
    REFERENCES `salas` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_npcs_mapas`
    FOREIGN KEY (`mapa_id`)
    REFERENCES `mapas_cenarios` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `mensagens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sala_id` INT NOT NULL,
  `personagem_id` INT NULL,
  `npc_id` INT NULL,
  `tipo` ENUM('acao', 'fala', 'narracao', 'npc', 'sistema') NOT NULL,
  `conteudo` TEXT NOT NULL,
  `enviada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_mensagens_sala_enviada` (`sala_id` ASC, `enviada_em` ASC),
  INDEX `fk_mensagens_personagens_idx` (`personagem_id` ASC),
  INDEX `fk_mensagens_npcs_idx` (`npc_id` ASC),
  CONSTRAINT `fk_mensagens_salas`
    FOREIGN KEY (`sala_id`)
    REFERENCES `salas` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mensagens_personagens`
    FOREIGN KEY (`personagem_id`)
    REFERENCES `personagens` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mensagens_npcs`
    FOREIGN KEY (`npc_id`)
    REFERENCES `npcs` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `rolagens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `mensagem_id` INT NOT NULL,
  `atributo` ENUM('forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma') NOT NULL,
  `pericia` VARCHAR(40) NULL,
  `faces` TINYINT UNSIGNED NOT NULL DEFAULT 20,
  `resultado` TINYINT UNSIGNED NOT NULL,
  `modificador` TINYINT NOT NULL DEFAULT 0,
  `dificuldade` TINYINT UNSIGNED NULL,
  `rolada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `fk_rolagens_mensagens_idx` (`mensagem_id` ASC),
  CONSTRAINT `fk_rolagens_mensagens`
    FOREIGN KEY (`mensagem_id`)
    REFERENCES `mensagens` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `ck_rolagens_faces` CHECK (`faces` IN (4, 6, 8, 10, 12, 20, 100)),
  CONSTRAINT `ck_rolagens_resultado` CHECK (`resultado` BETWEEN 1 AND `faces`)
) ENGINE = InnoDB;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
