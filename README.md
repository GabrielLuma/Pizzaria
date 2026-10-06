# Pizzaria Luna Luna

Primeira versão do site da pizzaria tradicional de Indaial, SC. Site responsivo com cardápio, busca por ingrediente, categorias, seleção de sabores e resumo de consulta. Sem dependências externas de execução.

## Interface e navegação

Tema escuro com resumo e valor atualizados durante a montagem. O botão de continuar fica ao lado do resumo no computador e fixo na parte inferior no celular. Sabores aparecem em uma lista compacta com rolagem própria. Marcar sabores e bordas atualiza apenas a seleção e o total, sem recriar os controles nem deslocar a tela. A busca de sabores consulta todo o cardápio; filtros e chips permitem conferir e retirar escolhas. Etapas anteriores e escolhas do resumo podem ser clicadas para revisar. Bordas, refri extra e molhos começam sem adicional, e o cliente pode continuar ou alterar essas opções.

Ao concluir a pizza, o carrinho abre para revisão, adicionar outra pizza ou finalizar. Remover um item oferece Desfazer; quantidade máxima é 20 por combinação. O resumo preparado é mantido ao fechar/reabrir o carrinho e invalidado quando o pedido ou os dados do cliente mudam.

## Desenvolvimento

Requer Node.js 22 ou superior.

```sh
cd /workspace/Pizzaria
npm run dev
```

Porta padrão: 3000. `PORT` permite outra porta. Execute `npm test` para validar seleção e resumo. O servidor usa a pasta `public` e não recebe nem armazena pedidos.

## Dados e pendências

O cardápio em `public/menu.js` foi transcrito da imagem fornecida: 55 sabores tradicionais, 7 especiais, 11 doces, 5 pratos chineses, 13 lanches, 17 porções, 5 bebidas e 1 molho. Total: 114 opções, além de 6 tamanhos de pizza e 5 opções de borda. Confirme a transcrição com a pizzaria antes da publicação. O site existente não pôde ser consultado: a tentativa de acesso retornou HTTP 403.

Os preços foram transcritos dos prints. Pizzas: broto 20 cm R$ 26; pequena 25 cm R$ 53; média 30 cm R$ 65 (valor promocional exibido); grande 35 cm + Guaraná Kuat R$ 99; gigante 45 cm + Kuat R$ 120; extra gigante 50 cm + Kuat R$ 135. O volume do Kuat dos combos não foi informado. Bordas: sem recheio R$ 0, Catupiry/Cheddar R$ 20 e chocolate ao leite/branco R$ 25. Cada sabor especial selecionado acrescenta R$ 5, conforme confirmação do usuário; os demais sabores não têm adicional. O cálculo usa centavos.

## Montagem do pedido

A pizza é montada na ordem: tamanho → borda (ou sem recheio) → sabores → refrigerante (ou sem) → molhos (ou sem). Os limites confirmados são: broto 1 sabor; pequena e média até 2; grande, gigante e extra gigante até 4. O cliente pode selecionar menos sabores que o limite. A seleção é preservada entre categorias, buscas e ao voltar às etapas anteriores. Trocar o tamanho mantém as escolhas compatíveis; quando o novo tamanho aceita menos sabores, os excedentes são retirados e a interface informa quais foram removidos. Na broto, tocar em outro sabor troca a seleção diretamente. O carrinho permite editar a pizza pronta, mantendo sua quantidade.

Nos combos, o Guaraná Kuat está sempre incluso e não existe desconto para removê-lo. A etapa é chamada **Refri adicional**; **Sem refri adicional** mantém o Kuat. Selecionar outra bebida soma seu preço e mantém o Kuat. Nas pizzas sem combo, a etapa permite escolher um refrigerante ou ficar sem. Molhos permitem escolher sem molho ou maionese caseira, com quantidade de 1 a 10 por pizza. O valor e o resumo incluem todos os acompanhamentos e suas quantidades. Aumentar a quantidade de uma pizza no carrinho também multiplica seus acompanhamentos.

No final, o cliente informa nome, observações opcionais e escolhe retirada ou uma **solicitação de entrega**. Para solicitar entrega é necessário um endereço. A área atendida e a taxa ainda serão definidas: a solicitação não garante atendimento e a taxa não está incluída no total dos itens. O resumo deixa essa pendência explícita. Ao voltar para retirada, o endereço não é enviado. Pagamento na entrega ou retirada. Endereço da pizzaria e horários de funcionamento ainda estão pendentes.

O número `+55 47 8842-1533` foi confirmado pelo usuário e está configurado em formato internacional somente com dígitos. O parâmetro do link antigo traz outro número e não foi usado como contato. O link `wa.me` abre a conversa com o resumo; o cliente ainda precisa tocar em enviar. A entrega da mensagem depende de o número ter uma conta ativa no WhatsApp; não foi realizado envio de mensagem durante a validação.

Envio automático à pizzaria e ao cliente, registro de pedidos e confirmação independente do WhatsApp exigem um backend e integração autorizada com WhatsApp Business. Não estão implementados neste protótipo. Não colete credenciais no navegador.

O carrinho e a montagem de uma nova pizza são salvos neste navegador por 24 horas, com validação dos itens ao restaurar. Nome, endereço e observações não são gravados: permanecem somente na memória da página e são incluídos na mensagem quando o cliente abre o WhatsApp. Se o armazenamento local estiver bloqueado, o fluxo continua funcionando sem persistência. Edições de pizzas prontas são aplicadas somente ao salvar; cancelar mantém o pedido anterior. A arte de pizza é uma ilustração local, não uma fotografia dos produtos reais.

## Hospedagem no Netlify

O projeto é um site estático e pode ser publicado sem servidor Node.js no Netlify. `netlify.toml` define `public` como pasta de publicação. Não há comando de build.

Para publicação via GitHub, os arquivos do projeto precisam estar enviados ao repositório primeiro. No Netlify, adicione um projeto, escolha a importação de um repositório existente e conecte a conta GitHub. Selecione `GabrielLuma/Pizzaria` e a branch que contém estes arquivos. Deixe o comando de build vazio e use `public` como pasta de publicação. O Netlify fornece um endereço HTTPS para testar o site após a publicação. O domínio próprio é opcional.

Alternativamente, quem tiver uma cópia local pode enviar a pasta `public` pelo Netlify Drop em https://app.netlify.com/drop. A pasta deve conter `index.html` na raiz. Nenhuma credencial deve ser colocada no código. O resumo abre o WhatsApp, mas a publicação não adiciona registro de pedidos ou envio automático de mensagens.

Confira os limites e condições atuais do plano gratuito ao criar a conta. O ambiente do Codex e a hospedagem do Netlify são serviços distintos; salvar ou publicar a configuração de nuvem não publica o site no Netlify.

## Reutilização do ambiente

Use o checkout existente: cada tarefa em nuvem já é isolada. Não crie worktrees, a menos que solicitado. Não há instalação de pacotes, banco de dados ou credenciais necessária para executar o protótipo. A inicialização do servidor e os testes devem ser repetidos em novas tarefas; processos não são preservados em snapshots.
