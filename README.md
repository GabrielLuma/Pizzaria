# Pizzaria Luna Luna

Primeira versão do site da pizzaria tradicional de Indaial, SC. Site responsivo com cardápio, busca por ingrediente, categorias, seleção de sabores e resumo de consulta. Sem dependências externas de execução.

## Desenvolvimento

Requer Node.js 22 ou superior.

```sh
cd /workspace/Pizzaria
npm run dev
```

Porta padrão: 3000. `PORT` permite outra porta. Execute `npm test` para validar seleção e resumo. O servidor usa a pasta `public` e não recebe nem armazena pedidos.

## Dados e pendências

O cardápio em `public/menu.js` foi transcrito da imagem fornecida: 55 sabores tradicionais, 7 especiais, 11 doces, 5 pratos chineses, 13 lanches, 17 porções, 5 bebidas e 1 molho. Total: 114 opções, além de 6 tamanhos de pizza e 5 opções de borda. Confirme a transcrição com a pizzaria antes da publicação. O site existente não pôde ser consultado: a tentativa de acesso retornou HTTP 403.

Os preços foram transcritos dos prints. Pizzas: broto 20 cm R$ 26; pequena 25 cm R$ 53; média 30 cm R$ 65 (valor promocional exibido); grande 35 cm + Guaraná Kuat R$ 99; gigante 45 cm + Kuat R$ 120; extra gigante 50 cm + Kuat R$ 135. O volume da bebida dos combos não foi informado. Sabores especiais acrescentam R$ 5 por pizza de um sabor. Bordas: sem recheio R$ 0, Catupiry/Cheddar R$ 20 e chocolate ao leite/branco R$ 25. Demais sabores não têm adicional, conforme confirmação do usuário. O total inclui todos esses valores e quantidades. A versão permite um sabor por pizza; quantidade de sabores por tamanho e regra para combinar sabores ainda precisam ser confirmadas. Endereço e horários também estão pendentes. O resumo é uma solicitação que requer o aceite da pizzaria. A entrega fica desabilitada até a definição da área e das taxas. Pagamento previsto na entrega/retirada; nesta versão somente retirada é selecionável.

O número `+55 47 8842-1533` foi confirmado pelo usuário e está configurado em formato internacional somente com dígitos. O parâmetro do link antigo traz outro número e não foi usado como contato. O link `wa.me` abre a conversa com o resumo; o cliente ainda precisa tocar em enviar. A entrega da mensagem depende de o número ter uma conta ativa no WhatsApp; não foi realizado envio de mensagem durante a validação.

Envio automático à pizzaria e ao cliente, registro de pedidos e confirmação independente do WhatsApp exigem um backend e integração autorizada com WhatsApp Business. Não estão implementados neste protótipo. Não colete credenciais no navegador.

Esta versão mantém a seleção somente na memória. Recarregar a página limpa a seleção; os dados do cliente não são gravados. A arte de pizza é uma ilustração local, não uma fotografia dos produtos reais.

## Ambiente

## Hospedagem no Netlify

O projeto é um site estático e pode ser publicado sem servidor Node.js no Netlify. `netlify.toml` define `public` como pasta de publicação. Não há comando de build.

Para publicação via GitHub, os arquivos do projeto precisam estar enviados ao repositório primeiro. No Netlify, adicione um projeto, escolha a importação de um repositório existente e conecte a conta GitHub. Selecione `GabrielLuma/Pizzaria` e a branch que contém estes arquivos. Deixe o comando de build vazio e use `public` como pasta de publicação. O Netlify fornece um endereço HTTPS para testar o site após a publicação. O domínio próprio é opcional.

Alternativamente, quem tiver uma cópia local pode enviar a pasta `public` pelo Netlify Drop em https://app.netlify.com/drop. A pasta deve conter `index.html` na raiz. Nenhuma credencial deve ser colocada no código. O resumo abre o WhatsApp, mas a publicação não adiciona registro de pedidos ou envio automático de mensagens.

Confira os limites e condições atuais do plano gratuito ao criar a conta. O ambiente do Codex e a hospedagem do Netlify são serviços distintos; salvar ou publicar a configuração de nuvem não publica o site no Netlify.

## Reutilização do ambiente

Use o checkout existente: cada tarefa em nuvem já é isolada. Não crie worktrees, a menos que solicitado. Não há instalação de pacotes, banco de dados ou credenciais necessária para executar o protótipo. A inicialização do servidor e os testes devem ser repetidos em novas tarefas; processos não são preservados em snapshots.
