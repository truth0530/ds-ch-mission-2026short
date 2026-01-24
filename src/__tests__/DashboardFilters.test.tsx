import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { FilterState, Stats } from '@/components/dashboard/types';

describe('DashboardFilters', () => {
    const defaultFilters: FilterState = {
        roleFilter: 'all',
        teamFilter: 'all',
        countryFilter: 'all',
        deptFilter: 'all',
        dateFrom: '',
        dateTo: '',
        searchQuery: '',
    };

    const defaultStats: Stats = {
        total: 100,
        byRole: { missionary: 10, leader: 20, team_member: 70 },
        teamMemberByTeam: {},
        missionaries: [],
        leaders: [],
        scaleAverages: [],
    };

    const mockOnFilterChange = jest.fn();
    const mockOnReset = jest.fn();
    const mockOnToggleAnalysis = jest.fn();
    const mockOnExport = jest.fn();

    const defaultProps = {
        filters: defaultFilters,
        onFilterChange: mockOnFilterChange,
        onReset: mockOnReset,
        uniqueTeams: ['팀A', '팀B'],
        uniqueCountries: ['한국', '미국'],
        uniqueDepts: ['부서1', '부서2'],
        filteredCount: 10,
        totalCount: 100,
        stats: defaultStats,
        showAnalysis: false,
        onToggleAnalysis: mockOnToggleAnalysis,
        onExport: mockOnExport,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders all filter controls', () => {
        render(<DashboardFilters {...defaultProps} />);

        expect(screen.getByLabelText('역할 필터')).toBeInTheDocument();
        expect(screen.getByLabelText('팀 필터')).toBeInTheDocument();
        expect(screen.getByLabelText('국가 필터')).toBeInTheDocument();
        expect(screen.getByLabelText('부서 필터')).toBeInTheDocument();
        expect(screen.getByLabelText('시작일')).toBeInTheDocument();
        expect(screen.getByLabelText('종료일')).toBeInTheDocument();
        expect(screen.getByLabelText('검색')).toBeInTheDocument();
    });

    it('displays count information', () => {
        render(<DashboardFilters {...defaultProps} />);

        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('/100건')).toBeInTheDocument();
    });

    it('calls onFilterChange when role filter changes', () => {
        render(<DashboardFilters {...defaultProps} />);

        const roleSelect = screen.getByLabelText('역할 필터');
        fireEvent.change(roleSelect, { target: { value: '선교사' } });

        expect(mockOnFilterChange).toHaveBeenCalledWith('roleFilter', '선교사');
    });

    it('calls onFilterChange when team filter changes', () => {
        render(<DashboardFilters {...defaultProps} />);

        const teamSelect = screen.getByLabelText('팀 필터');
        fireEvent.change(teamSelect, { target: { value: '팀A' } });

        expect(mockOnFilterChange).toHaveBeenCalledWith('teamFilter', '팀A');
    });

    it('calls onFilterChange when search query changes', () => {
        render(<DashboardFilters {...defaultProps} />);

        const searchInput = screen.getByLabelText('검색');
        fireEvent.change(searchInput, { target: { value: 'test' } });

        expect(mockOnFilterChange).toHaveBeenCalledWith('searchQuery', 'test');
    });

    it('calls onReset when reset button is clicked', () => {
        render(<DashboardFilters {...defaultProps} />);

        const resetButton = screen.getByLabelText('필터 초기화');
        fireEvent.click(resetButton);

        expect(mockOnReset).toHaveBeenCalled();
    });

    it('renders unique teams in dropdown', () => {
        render(<DashboardFilters {...defaultProps} />);

        const teamSelect = screen.getByLabelText('팀 필터');
        expect(teamSelect).toHaveTextContent('팀A');
        expect(teamSelect).toHaveTextContent('팀B');
    });

    it('renders unique countries in dropdown', () => {
        render(<DashboardFilters {...defaultProps} />);

        const countrySelect = screen.getByLabelText('국가 필터');
        expect(countrySelect).toHaveTextContent('한국');
        expect(countrySelect).toHaveTextContent('미국');
    });

    it('calls onToggleAnalysis when analysis button is clicked', () => {
        render(<DashboardFilters {...defaultProps} />);

        const analysisButton = screen.getByText('통계분석');
        fireEvent.click(analysisButton);

        expect(mockOnToggleAnalysis).toHaveBeenCalled();
    });

    it('calls onExport when export button is clicked', () => {
        render(<DashboardFilters {...defaultProps} />);

        const exportButton = screen.getByText('Excel');
        fireEvent.click(exportButton);

        expect(mockOnExport).toHaveBeenCalled();
    });

    it('displays stats information', () => {
        render(<DashboardFilters {...defaultProps} />);

        expect(screen.getByText('100')).toBeInTheDocument(); // totalCount
        expect(screen.getByText('10')).toBeInTheDocument(); // missionary count or filteredCount
    });
});
