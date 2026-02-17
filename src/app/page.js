"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";

export default function Home() {
  const [arquivosALL, setArquivosALL] = useState([]);
  const [formatoSelected, setFormatoSelected] = useState("image/png");
  const [taConvertendo, setTaConvertendo] = useState(false);
  const [arrastandoItem, setArrastandoItem] = useState(false);
  const [libHeic, setLibHeic] = useState(null);

  useEffect(() => {
    const carregarLib = async () => {
      const modulo = await import("heic2any");
      if (modulo) {
        if (modulo.default) {
          setLibHeic(() => modulo.default);
        }
      }
    };
    carregarLib();
  }, []);

  const handleAcaoDrag = (e) => {
    e.preventDefault();
    if (arrastandoItem === false) {
      setArrastandoItem(true);
    }
  };

  const handleSairDrag = () => {
    if (arrastandoItem === true) {
      setArrastandoItem(false);
    }
  };

  const handleDropArquivos = (e) => {
    e.preventDefault();
    setArrastandoItem(false);
    if (e.dataTransfer) {
      if (e.dataTransfer.files) {
        adicionarNaLista(e.dataTransfer.files);
      }
    }
  };

  const handleInputManual = (e) => {
    if (e.target) {
      if (e.target.files) {
        adicionarNaLista(e.target.files);
      }
    }
  };

  const adicionarNaLista = (filesNovos) => {
    const listaTemporaria = Array.from(filesNovos).map((arquivo) => {
      let idGerado = Math.random().toString(36).substring(2);
      let tamanhoCalculado = (arquivo.size / 1024 / 1024).toFixed(2) + " MB";

      return {
        idItem: idGerado,
        dadosFile: arquivo,
        nomeOriginal: arquivo.name,
        tamanhoFormatado: tamanhoCalculado,
        statusProcesso: "esperando",
        urlConvertida: null,
        blobConvertido: null,
      };
    });
    setArquivosALL((prev) => [...prev, ...listaTemporaria]);
  };

  const removerArquivoAction = (id) => {
    const listaFiltrada = [];
    for (let i = 0; i < arquivosALL.length; i++) {
      if (arquivosALL[i].idItem !== id) {
        listaFiltrada.push(arquivosALL[i]);
      } else {
        // não faz nada se for o id
      }
    }
    setArquivosALL(listaFiltrada);
  };

  const converterAgoraSingle = async (objetoFoto) => {
    try {
      let imagemParaTrabalhar = objetoFoto.dadosFile;

      if (imagemParaTrabalhar.type === "image/heic") {
        if (libHeic !== null) {
          const resultHeic = await libHeic({
            blob: imagemParaTrabalhar,
            toType: "image/jpeg",
          });
          if (Array.isArray(resultHeic)) {
            imagemParaTrabalhar = resultHeic[0];
          } else {
            imagemParaTrabalhar = resultHeic;
          }
        }
      } else {
        if (objetoFoto.nomeOriginal.toLowerCase().endsWith(".heic")) {
          if (libHeic !== null) {
            const resultHeic = await libHeic({
              blob: imagemParaTrabalhar,
              toType: "image/jpeg",
            });
            if (Array.isArray(resultHeic)) {
              imagemParaTrabalhar = resultHeic[0];
            } else {
              imagemParaTrabalhar = resultHeic;
            }
          }
        }
      }

      return new Promise((resolve, reject) => {
        const createImg = new Image();
        const pathTemporario = URL.createObjectURL(imagemParaTrabalhar);
        createImg.src = pathTemporario;

        createImg.onload = () => {
          const meuCanvas = document.createElement("canvas");
          meuCanvas.width = createImg.width;
          meuCanvas.height = createImg.height;
          const contexto = meuCanvas.getContext("2d");

          if (formatoSelected === "image/jpeg") {
            contexto.fillStyle = "#FFFFFF";
            contexto.fillRect(0, 0, meuCanvas.width, meuCanvas.height);
          } else {
            // não precisa de fundo branco se for png
          }

          contexto.drawImage(createImg, 0, 0);

          meuCanvas.toBlob(
            (blobGerado) => {
              URL.revokeObjectURL(pathTemporario);
              if (blobGerado !== null) {
                if (blobGerado !== undefined) {
                  resolve({
                    ...objetoFoto,
                    statusProcesso: "pronto",
                    blobConvertido: blobGerado,
                    urlConvertida: URL.createObjectURL(blobGerado),
                  });
                } else {
                  reject();
                }
              } else {
                reject();
              }
            },
            formatoSelected,
            0.9,
          );
        };
        createImg.onerror = () => {
          reject();
        };
      });
    } catch (err) {
      return { ...objetoFoto, statusProcesso: "erro" };
    }
  };

  const iniciarConversaoAll = async () => {
    if (arquivosALL.length > 0) {
      setTaConvertendo(true);

      for (let i = 0; i < arquivosALL.length; i++) {
        if (arquivosALL[i].statusProcesso !== "pronto") {
          if (arquivosALL[i].statusProcesso !== "erro") {
            setArquivosALL((atualmente) =>
              atualmente.map((f, index) => {
                if (index === i) {
                  return { ...f, statusProcesso: "convertendo" };
                } else {
                  return f;
                }
              }),
            );

            const resultadoFinal = await converterAgoraSingle(arquivosALL[i]);

            setArquivosALL((atualmente) =>
              atualmente.map((f, index) => {
                if (index === i) {
                  return resultadoFinal;
                } else {
                  return f;
                }
              }),
            );
          }
        }
      }
      setTaConvertendo(false);
    } else {
      // não tem arquivo pra converter
    }
  };

  const handleDownloadResult = async () => {
    const itensProntos = arquivosALL.filter(
      (f) => f.statusProcesso === "pronto",
    );

    if (itensProntos.length > 0) {
      const extensaoFinal = formatoSelected.split("/")[1];

      if (itensProntos.length === 1) {
        const fileSolo = itensProntos[0];
        const linkDownload = document.createElement("a");
        linkDownload.href = fileSolo.urlConvertida;
        linkDownload.download =
          fileSolo.nomeOriginal.replace(/\.[^/.]+$/, "") + `.${extensaoFinal}`;
        linkDownload.click();
      } else {
        const zipFile = new JSZip();
        itensProntos.forEach((item) => {
          const novoNome =
            item.nomeOriginal.replace(/\.[^/.]+$/, "") + `.${extensaoFinal}`;
          zipFile.file(novoNome, item.blobConvertido);
        });
        const conteudoZip = await zipFile.generateAsync({ type: "blob" });
        const linkZip = document.createElement("a");
        linkZip.href = URL.createObjectURL(conteudoZip);
        linkZip.download = "assets.zip";
        linkZip.click();
      }
    }
  };

  return (
    <>
      <nav className="w-full border-b border-zinc-800 bg-black/50 backdrop-blur-md stibcky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">
              Conversor de Imagens
            </span>
          </div>
          <a
            href="https://github.com/luffylofy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-full text-sm font-medium transition-all border border-zinc-700"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </nav>

      <main className="min-h-screen bg-[#0a0a0a] text-zinc-200 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-black text-white mb-2 bg-gradient-to-r from-indigo-500 to-purple-400 bg-clip-text text-transparent">
              Meu Conversor de Imagens
            </h1>
            <p className="text-zinc-500">Converta imagens, gratuitamente.</p>
          </header>

          <div
            onDragOver={handleAcaoDrag}
            onDragLeave={handleSairDrag}
            onDrop={handleDropArquivos}
            className={`
              relative border-2 border-dashed rounded-3xl p-16 text-center transition-all
              ${arrastandoItem === true ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]" : "border-zinc-800 bg-zinc-900/40"}
            `}
          >
            <input
              type="file"
              multiple
              accept="image/*,.heic,.bmp,.tiff,.gif,.webp"
              onChange={handleInputManual}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center">
              <div className="mb-4 p-4 bg-zinc-800 rounded-full text-indigo-400">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <p className="text-xl font-bold">Escolher arquivos</p>
              <p className="text-sm text-zinc-500 mt-2">
                Aceita tudo: PNG, JPG, WEBP, HEIC, BMP...
              </p>
            </div>
          </div>

          {arquivosALL.length > 0 ? (
            <div className="mt-8 flex flex-wrap items-center justify-between bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400">Quero em:</span>
                <select
                  value={formatoSelected}
                  onChange={(e) => setFormatoSelected(e.target.value)}
                  className="bg-zinc-800 text-white rounded-lg px-4 py-2 border border-zinc-700 outline-none"
                >
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/webp">WEBP</option>
                  <option value="image/bmp">BMP</option>
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setArquivosALL([])}
                  className="text-zinc-500 hover:text-white transition"
                >
                  Limpar Lista
                </button>
                <button
                  onClick={iniciarConversaoAll}
                  disabled={taConvertendo}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-3 rounded-xl font-black shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {taConvertendo === true ? "CONVERTENDO..." : "Converter"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 space-y-4">
            {arquivosALL.map((item) => (
              <div
                key={item.idItem}
                className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                    {item.nomeOriginal.split(".").pop()}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold truncate">
                      {item.nomeOriginal}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {item.tamanhoFormatado}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <StatusBadge statusShow={item.statusProcesso} />
                  <button
                    onClick={() => removerArquivoAction(item.idItem)}
                    className="text-zinc-600 hover:text-red-500 transition"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {arquivosALL.some((f) => f.statusProcesso === "pronto") ? (
            taConvertendo === false ? (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
                <button
                  onClick={handleDownloadResult}
                  className="bg-white text-black px-12 py-4 rounded-full font-black shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Baixar
                </button>
              </div>
            ) : null
          ) : null}
        </div>
      </main>
    </>
  );
}

function StatusBadge({ statusShow }) {
  if (statusShow === "esperando") {
    return (
      <span className="text-[10px] font-bold bg-zinc-800 px-3 py-1 rounded-full text-zinc-400">
        NA FILA
      </span>
    );
  } else {
    if (statusShow === "convertendo") {
      return (
        <span className="text-[10px] font-bold bg-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 animate-pulse">
          PROCESSANDO
        </span>
      );
    } else {
      if (statusShow === "pronto") {
        return (
          <span className="text-[10px] font-bold bg-emerald-500/20 px-3 py-1 rounded-full text-emerald-400">
            OK!
          </span>
        );
      } else {
        if (statusShow === "erro") {
          return (
            <span className="text-[10px] font-bold bg-red-500/20 px-3 py-1 rounded-full text-red-400">
              ERRO
            </span>
          );
        } else {
          return null;
        }
      }
    }
  }
}
