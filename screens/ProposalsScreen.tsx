import React, { useEffect, useState, useMemo } from 'react';
import { apiService } from '../services/apiService';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import sanitizeHtml from '../services/sanitizeHtml';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

import {
  FiSearch,
  FiFilter,
  FiExternalLink,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiXCircle,
  FiMinusCircle,
  FiCalendar,
  FiDollarSign,
  FiAlertTriangle,
} from 'react-icons/fi';

type ProposalsScreenProps = {
  navigate?: (path: string) => void;
};

type Proposal = {
  id: string;
  title: string;
  name?: string;
  category?: string;
  type?: string;
  investment_amount?: number;
  risk_level?: string;
  status?: string;
  state?: string;
  user_vote?: 'yes' | 'no' | 'abstain';
  permalink?: string;
  link?: string;
  description?: string;
  content?: string;
  excerpt?: string;
  created_at?: string;
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
  attachments?: any[];
  files?: any[];
};

const ProposalsScreen: React.FC<ProposalsScreenProps> = ({ navigate }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    setLoading(true);
    apiService.getProposals()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data.value || data.proposals || []);
        setProposals(list || []);
      })
      .catch(err => {
        console.error('Failed to load proposals', err);
        setProposals([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    proposals.forEach(p => {
      if (p.category) cats.add(p.category);
      if (p.type) cats.add(p.type);
    });
    return Array.from(cats);
  }, [proposals]);

  const statuses = useMemo(() => {
    const stats = new Set<string>();
    proposals.forEach(p => {
      if (p.status) stats.add(p.status);
      if (p.state) stats.add(p.state);
    });
    return Array.from(stats);
  }, [proposals]);

  const filteredProposals = useMemo(() => {
    return proposals.filter(p => {
      const matchesSearch = search === '' || 
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || 
        p.category === categoryFilter || 
        p.type === categoryFilter;

      const matchesStatus = statusFilter === 'all' || 
        p.status === statusFilter || 
        p.state === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [proposals, search, categoryFilter, statusFilter]);

  const openOnSite = async (p: Proposal) => {
    const direct = p?.permalink || p?.link;
    const directUrl = direct ? String(direct).trim() : '';
    
    if (directUrl) {
      try {
        window.open(directUrl, '_blank', 'noopener');
        return;
      } catch (e) {
        try { 
          window.location.href = directUrl; 
          return; 
        } catch (_) { /* ignore */ }
      }
    }

    try {
      setLoading(true);
      const d = await apiService.getProposalDetails(Number(p.id));
      const merged = { ...p, ...d };
      const urlCandidate = merged.permalink || merged.link || '';
      const url = urlCandidate ? String(urlCandidate).trim() : '';
      
      if (!url) {
        show('No link available for this proposal', 'error');
        return;
      }
      
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error('Failed to open on site', err, { proposal: p });
      show('Failed to open proposal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleProposalExpansion = (id: string) => {
    setExpandedProposal(expandedProposal === id ? null : id);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMeta, setConfirmMeta] = useState<{ 
    proposal: Proposal | null; 
    vote?: 'yes' | 'no' | 'abstain' 
  } | null>(null);

  const submitVote = async (proposal: Proposal, vote: 'yes' | 'no' | 'abstain') => {
    setConfirmMeta({ proposal, vote });
    setConfirmOpen(true);
  };

  const doSubmitVote = async () => {
    if (!confirmMeta) return;
    const { proposal, vote } = confirmMeta;
    setConfirmOpen(false);
    setConfirmMeta(null);
    
    const previousVote = proposal?.user_vote || null;
    
    // Optimistic update
    setProposals(prev => prev.map(p => 
      p.id === proposal.id ? { ...p, user_vote: vote } : p
    ));
    
    setSelected(prev => prev && prev.id === proposal.id ? { ...prev, user_vote: vote } : prev);

    try {
      setLoading(true);
      const res = await apiService.submitProposalVote(Number(proposal.id), vote!);
      show(res?.message || 'Vote submitted successfully', 'success');
    } catch (err: any) {
      console.error('Vote failed', err);
      // Revert optimistic update
      setProposals(prev => prev.map(p => 
        p.id === proposal.id ? { ...p, user_vote: previousVote } : p
      ));
      setSelected(prev => prev && prev.id === proposal.id ? 
        { ...prev, user_vote: previousVote } : prev
      );
      show(err?.message || 'Failed to submit vote', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalHtml, setModalHtml] = useState<string>('');

  const getVoteIcon = (vote?: string) => {
    switch (vote) {
      case 'yes': return <span className="text-green-500">✓</span>;
      case 'no': return <span className="text-red-500">✗</span>;
      case 'abstain': return <span className="text-gray-500">—</span>;
      default: return null;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('active') || statusLower.includes('open')) {
      return 'bg-green-100 text-green-800';
    } else if (statusLower.includes('pending') || statusLower.includes('review')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (statusLower.includes('closed') || statusLower.includes('completed')) {
      return 'bg-blue-100 text-blue-800';
    } else if (statusLower.includes('rejected') || statusLower.includes('failed')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (risk?: string) => {
    if (!risk) return 'bg-gray-100';
    
    const riskLower = risk.toLowerCase();
    if (riskLower.includes('low')) return 'bg-green-100 text-green-800';
    if (riskLower.includes('medium')) return 'bg-yellow-100 text-yellow-800';
    if (riskLower.includes('high')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading && proposals.length === 0) return <Spinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
        <p className="text-sm text-gray-600 mt-1">Vote on investment opportunities</p>
        
        {/* Search Bar */}
        <div className="mt-4 relative">
          <FiSearch {...({ className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" } as any)} />
          <input
            type="text"
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mt-3 flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <FiFilter {...({ className: "mr-2 w-4 h-4" } as any)} />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 space-y-3 animate-slideDown">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg p-3 shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-900">{filteredProposals.length}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredProposals.filter(p => p.status?.toLowerCase().includes('active')).length}
            </div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">
              {filteredProposals.filter(p => p.user_vote).length}
            </div>
            <div className="text-xs text-gray-600">Voted</div>
          </div>
        </div>

        {/* Proposals List */}
        {filteredProposals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No proposals found</h3>
            <p className="text-gray-600">
              {search || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No proposals available at the moment'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProposals.map(proposal => {
              const isExpanded = expandedProposal === proposal.id;
              
              return (
                <Card key={proposal.id} className="overflow-hidden">
                  {/* Proposal Header */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleProposalExpansion(proposal.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {proposal.title || proposal.name}
                          </h3>
                          {getVoteIcon(proposal.user_vote)}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {proposal.category && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {proposal.category}
                            </span>
                          )}
                          {proposal.status && (
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(proposal.status)}`}>
                              {proposal.status}
                            </span>
                          )}
                          {proposal.risk_level && (
                            <span className={`px-2 py-1 text-xs rounded-full ${getRiskColor(proposal.risk_level)}`}>
                              <FiAlertTriangle {...({ className: "inline mr-1 w-4 h-4 text-yellow-600" } as any)} /> {proposal.risk_level}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button className="ml-2">
                        {isExpanded ? <FiChevronUp {...({ className: "w-4 h-4" } as any)} /> : <FiChevronDown {...({ className: "w-4 h-4" } as any)} />}
                      </button>
                    </div>

                    {/* Quick Info Row */}
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <FiDollarSign {...({ className: "mr-2 w-4 h-4" } as any)} />
                        <span className="font-medium">
                          {proposal.investment_amount 
                            ? `$${Number(proposal.investment_amount).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}`
                            : 'N/A'
                          }
                        </span>
                      </div>
                      {proposal.created_at && (
                          <div className="flex items-center text-gray-600">
                            <FiCalendar {...({ className: "mr-2 w-4 h-4" } as any)} />
                          <span>{new Date(proposal.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 animate-slideDown">
                      {/* Description Preview */}
                      {proposal.description && (
                        <div className="mb-4">
                          <p className="text-gray-700 line-clamp-3">
                            {proposal.description}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="space-y-3">
                          <div className="flex space-x-2">
                          <Button
                            onClick={() => openOnSite(proposal)}
                            variant="outline"
                            className="flex-1"
                          >
                            <FiExternalLink {...({ className: "mr-2 w-4 h-4 inline" } as any)} />
                            View Details
                          </Button>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                          <p className="text-sm font-medium text-gray-700 mb-3">Cast your vote:</p>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={() => submitVote(proposal, 'yes')}
                              variant={proposal.user_vote === 'yes' ? 'primary' : 'secondary'}
                              className={`${proposal.user_vote === 'yes' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                            >
                                <FiCheckCircle {...({ className: "mr-1 w-4 h-4 inline" } as any)} />
                              Yes
                            </Button>
                            <Button
                              onClick={() => submitVote(proposal, 'no')}
                              variant={proposal.user_vote === 'no' ? 'primary' : 'secondary'}
                              className={`${proposal.user_vote === 'no' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                            >
                              <FiXCircle {...({ className: "mr-1 w-4 h-4 inline" } as any)} />
                              No
                            </Button>
                            <Button
                              onClick={() => submitVote(proposal, 'abstain')}
                              variant={proposal.user_vote === 'abstain' ? 'primary' : 'secondary'}
                              className={`${proposal.user_vote === 'abstain' ? 'bg-gray-500 hover:bg-gray-600' : ''}`}
                            >
                              <FiMinusCircle {...({ className: "mr-1 w-4 h-4 inline" } as any)} />
                              Abstain
                            </Button>
                          </div>
                          {proposal.user_vote && (
                            <p className="text-sm text-gray-600 mt-2 text-center">
                              You voted: <span className="font-medium capitalize">{proposal.user_vote}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Proposal Modal */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={selected?.title || selected?.name || 'Proposal'}
        size="lg"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ 
              __html: sanitizeHtml(String(modalHtml || '')) 
            }} />
          </div>

          {/* Attachments */}
          {selected && (() => {
            const attachments = selected.attachments || selected.files || [];
            if (!attachments.length) return null;
            
            return (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Attachments</h4>
                        <div className="space-y-2">
                  {attachments.map((a: any, idx: number) => {
                    if (typeof a === 'function') return null;
                    const url = a?.url || a?.link || (typeof a === 'string' ? a : null);
                    const title = a?.title || a?.name || `Attachment ${idx + 1}`;
                    
                    if (!url || String(url).toLowerCase().startsWith('javascript:')) return null;
                    
                    return (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <FiCheckCircle {...({ className: "mr-3 w-5 h-5 text-gray-600" } as any)} />
                        <span className="text-sm text-gray-900">{title}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex flex-col space-y-3">
            {selected?.permalink && (
              <Button
                onClick={() => {
                  try {
                    window.open(String(selected.permalink), '_blank', 'noopener');
                  } catch (e) {
                    window.location.href = String(selected.permalink);
                  }
                }}
                variant="outline"
              >
                <FiExternalLink {...({ className: "mr-2 w-4 h-4 inline" } as any)} />
                Open on Site
              </Button>
            )}
            
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => selected && submitVote(selected, 'yes')}
                variant={selected?.user_vote === 'yes' ? 'primary' : 'secondary'}
                className={selected?.user_vote === 'yes' ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                <FiCheckCircle {...({ className: "mr-1 w-4 h-4 inline" } as any)} />
                Yes
              </Button>
              <Button
                onClick={() => selected && submitVote(selected, 'no')}
                variant={selected?.user_vote === 'no' ? 'primary' : 'secondary'}
                className={selected?.user_vote === 'no' ? 'bg-red-500 hover:bg-red-600' : ''}
              >
                <FiXCircle {...({ className: "mr-1 w-4 h-4 inline" } as any)} />
                No
              </Button>
              <Button
                onClick={() => selected && submitVote(selected, 'abstain')}
                variant={selected?.user_vote === 'abstain' ? 'primary' : 'secondary'}
                className={selected?.user_vote === 'abstain' ? 'bg-gray-500 hover:bg-gray-600' : ''}
              >
                <FiMinusCircle {...({ className: "mr-1 w-4 h-4 inline" } as any)} />
                Abstain
              </Button>
            </div>
            
            {selected?.user_vote && (
              <p className="text-center text-sm text-gray-600">
                Current vote: <span className="font-medium capitalize">{selected.user_vote}</span>
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Vote Confirmation Modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmMeta?.proposal ? `Vote on "${confirmMeta.proposal.title}"` : 'Confirm Vote'}
        message={confirmMeta ? `Are you sure you want to vote "${confirmMeta.vote}" on this proposal? This action cannot be undone.` : ''}
        onConfirm={doSubmitVote}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmMeta(null);
        }}
        confirmLabel={`Vote ${confirmMeta?.vote?.toUpperCase() || ''}`}
        cancelLabel="Cancel"
        variant={confirmMeta?.vote === 'yes' ? 'success' : confirmMeta?.vote === 'no' ? 'danger' : 'default'}
      />
    </div>
  );
};

export default ProposalsScreen;