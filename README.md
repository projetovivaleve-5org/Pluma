# 🪶 Pluma

### Um momento de calma, a um clique de distância.

**Pluma** é uma plataforma web de apoio emocional e bem-estar. Ela ajuda a pessoa a **perceber como está se sentindo**, **organizar os próprios pensamentos** e **respirar fundo quando precisa**, tudo em um espaço leve, simples e acolhedor.

 **Experimente agora:** https://projetopluma.vercel.app

>  A Pluma é uma ferramenta de apoio e **não substitui** acompanhamento profissional. Em caso de crise, ligue para o **CVV: 188** (24 horas).

---

##  O problema

Cuidar da saúde mental começa por algo básico: **notar o que se sente**. Só que, na correria do dia a dia:

- é difícil parar para entender o próprio humor;
- muitos apps de bem-estar são complexos, cheios de notificações ou parecem mais uma tarefa;
- falta um lugar simples para registrar o que se sente e **ver a própria evolução ao longo do tempo**;
- quando a pessoa precisa de ajuda de verdade, nem sempre sabe para onde ir.

##  A solução

A Pluma reúne, em um só lugar e sem complicação, o essencial do autocuidado diário:

1. **Registre o humor** em poucos segundos.
2. **Escreva no diário** o que está na sua cabeça.
3. **Acompanhe o histórico** e perceba padrões.
4. **Respire com o exercício guiado** quando a ansiedade apertar.
5. **Encontre ajuda profissional** com links diretos para a rede de apoio.

O nome diz tudo: **leve como uma pluma**.

---

##  Funcionalidades

 Funcionalidade | O que faz |
|---|---|
 | **Registro de humor** | Registra como você está se sentindo hoje, de forma rápida. |
 | **Diário** | Espaço livre para escrever pensamentos e reflexões. |
 | **Histórico** | Reúne seus registros para você acompanhar a evolução. |
 | **Respirar** | Exercício de respiração guiada no padrão **3-4-5**. |
 | **Conversar** | Tela para conversar com a Pluma. |
 | **Sons relaxantes** | Sons ambiente para ajudar a desacelerar. |
 | **Rede de apoio** | CVV (188), busca de psicólogos, terapia online e conteúdo educativo. |
 | **Conta pessoal** | Cadastro e login, para que seus dados sejam só seus. |

---

# Por que a Pluma é diferente

- **Simples de verdade.** Poucas telas, linguagem acolhedora e nenhuma sobrecarga de informação.
- **Acessibilidade como princípio.** Navegação consistente, contraste adequado e design responsivo para celular e computador.
- **Responsável.** Deixa claro o que não é: não faz diagnóstico nem substitui profissionais, e sempre aponta o caminho para ajuda especializada.
- **Privacidade em primeiro lugar.** Tem política de privacidade própria e foi pensada para lidar com dados sensíveis com cuidado.
- **Pronta para crescer.** Front-end e back-end separados, com API própria, banco de dados e deploy em nuvem.

---

##  Como a Pluma funciona por dentro

```text
 Você (navegador)
       │
       ▼
┌─────────────────┐   HTTPS   ┌────────────────────┐      ┌──────────────┐
│ Front-end       │ ────────► │ API REST           │ ───► │ PostgreSQL   │
│ HTML • CSS • JS │ ◄──────── │ Java + Spring Boot │ ◄─── │ (Render)     │
│ (Vercel)        │           │ (Render + Docker)  │      └──────────────┘
└─────────────────┘           └────────────────────┘
```

- **Front-end:** HTML, CSS e JavaScript puros, publicado na Vercel. As chamadas à API ficam centralizadas em `js/api.js`.
- **Back-end:** API REST em Java com Spring Boot, publicada na Render com Docker. Veja o repositório: [back-end_vivaleve](https://github.com/projetovivaleve-5org/back-end_vivaleve).

---

## Para onde queremos ir

Queremos que a Pluma seja um apoio de verdade no dia a dia de quem estuda e trabalha sob pressão. Os próximos passos são testar o app com mais pessoas, aprender com o uso real e explorar **parcerias com instituições de ensino e profissionais de saúde mental**, que poderiam oferecer a Pluma como ferramenta complementar para seus alunos e pacientes.

---

## Rodando o front-end localmente

```bash
git clone https://github.com/projetovivaleve-5org/Pluma.git
cd Pluma
```

1. Abra o arquivo `js/api.js` e configure a **URL da API** (local ou publicada).
2. Sirva a pasta com um servidor estático, por exemplo a extensão **Live Server** do VS Code, e abra `index.html`.

### Estrutura

```text
Pluma/
├── css/            # Estilos
├── js/             # Scripts (api.js concentra as chamadas ao back-end)
├── index.html      # Início
├── login.html      # Login e cadastro
├── humor.html      # Registro de humor
├── diario.html     # Diário
├── historico.html  # Histórico
├── respirar.html   # Respiração guiada
├── chat.html       # Conversar
└── config.html     # Configurações
```

---

##  Equipe

Projeto desenvolvido por estudantes, com foco em acessibilidade, bem-estar e interação do usuário.

| Nome | 

Tsukii3

Lucas

Igor Moura

Gustavo Ferrão

<!-- VERIFICAR: preencher integrantes, papéis e links do GitHub/LinkedIn -->

## Links

-  Aplicação: https://projetopluma.vercel.app
-  Back-end: https://github.com/projetovivaleve-5org/back-end_vivaleve
-  Política de privacidade: https://policy-private-pluma.vercel.app/

---
