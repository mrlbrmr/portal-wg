"use client";

interface Props {
  candidateId: string;
}

export default function AnonymizeButton({ candidateId }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (
      !confirm(
        "Tem certeza? Esta ação remove todos os dados pessoais e o currículo. É irreversível."
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={`/api/candidates/${candidateId}/anonymize`}
      method="POST"
      onSubmit={handleSubmit}
    >
      <button
        type="submit"
        className="text-xs text-red-600 border border-red-300 hover:bg-red-100 px-3 py-1.5 rounded-lg w-full transition-colors"
      >
        Anonimizar candidato
      </button>
    </form>
  );
}
