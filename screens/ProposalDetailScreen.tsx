import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import sanitizeHtml from '../services/sanitizeHtml';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

type Props = {
    proposalId: number;
    onBack: () => void;
};

const ProposalDetailScreen: React.FC<Props> = ({ proposalId, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [proposal, setProposal] = useState<any | null>(null);
    const { show } = useToast();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMeta, setConfirmMeta] = useState<{ vote?: 'yes' | 'no' | 'abstain' } | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        apiService.getProposalDetails(proposalId)
            .then((data) => {
                if (!mounted) return;
                // If REST returned normalized object or plain data, keep it
                setProposal(data);
            })
            .catch(err => {
                console.error('Failed to fetch proposal details', err);
                setProposal(null);
            })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [proposalId]);

    const submitVote = (vote: 'yes' | 'no' | 'abstain') => {
        setConfirmMeta({ vote });
        setConfirmOpen(true);
    };

    const doSubmitVote = async () => {
        if (!confirmMeta || !proposal) return;
        setConfirmOpen(false);
        const vote = confirmMeta.vote!;
        try {
            setLoading(true);
            const res = await apiService.submitProposalVote(proposal.id || proposal.proposal_id || proposalId, vote);
            setProposal(prev => prev ? Object.assign({}, prev, { user_vote: vote }) : prev);
            show((res && (res.message || 'Your vote was recorded')) || 'Your vote was recorded', 'success');
        } catch (err: any) {
            console.error('Vote failed', err);
            show((err && err.message) || 'Failed to submit vote', 'error');
        } finally { setLoading(false); }
    };

    if (loading) return <div className="p-6"><Spinner /></div>;

    if (!proposal) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <Button onClick={onBack} variant="secondary">Back</Button>
                    <h1 className="text-xl font-semibold">Proposal</h1>
                    <div />
                </div>
                <div className="p-4">Unable to load proposal details.</div>
            </div>
        );
    }

    const attachments: any[] = (() => {
        let a: any = proposal.attachments || proposal.files || proposal.media || [];
        if (!a) return [];
        if (!Array.isArray(a)) {
            if (typeof a === 'object') return Object.values(a);
            return [a];
        }
        return a;
    })();

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <Button onClick={onBack} variant="secondary">Back</Button>
                <h1 className="text-xl font-semibold">{proposal.title || proposal.name || 'Proposal'}</h1>
                <div />
            </div>

            <div className="prose max-w-none mb-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(proposal.description || proposal.content || '')) }} />

            {attachments.length > 0 && (
                <div className="mb-4">
                    <h4 className="font-semibold">Attachments</h4>
                    <ul className="list-disc pl-5 mt-2">
                        {attachments.map((a: any, idx: number) => {
                            if (typeof a === 'function') return null;
                            const candidateUrl = a && (a.url || a.link || a.file || a.src);
                            const url = candidateUrl || (typeof a === 'string' ? a : null);
                            if (!url) return null;
                            const safe = String(url).trim();
                            if (safe.toLowerCase().startsWith('javascript:')) return null;
                            const href = safe.startsWith('/') ? window.location.origin + safe : safe;
                            const title = (a && (a.title || a.name)) || href;
                            return <li key={idx}><a href={href} target="_blank" rel="noreferrer noopener" className="text-primary-600 hover:underline">{String(title)}</a></li>;
                        })}
                    </ul>
                </div>
            )}

            <div className="flex items-center space-x-2">
                <Button onClick={() => submitVote('yes')}>Vote Yes</Button>
                <Button onClick={() => submitVote('no')} variant="secondary">Vote No</Button>
                <Button onClick={() => submitVote('abstain')} variant="outline">Abstain</Button>
                {proposal.user_vote && <div className="ml-3 text-sm text-muted">You voted: {proposal.user_vote}</div>}
            </div>

            {/* Open on site */}
            {proposal.permalink && (
                <div className="mt-4">
                    <Button onClick={() => {
                        try { window.open(String(proposal.permalink), '_blank', 'noopener'); }
                        catch { try { window.location.href = String(proposal.permalink); } catch (_) { /* ignore */ } }
                    }} variant="secondary">Open on site</Button>
                </div>
            )}

            <ConfirmModal
                open={confirmOpen}
                title={`Confirm Vote`}
                message={confirmMeta ? `Are you sure you want to vote "${confirmMeta.vote}"?` : 'Are you sure?'}
                onConfirm={doSubmitVote}
                onCancel={() => setConfirmOpen(false)}
                confirmLabel="Vote"
                cancelLabel="Cancel"
            />
        </div>
    );
};

export default ProposalDetailScreen;
